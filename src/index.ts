import type { WhereExpressionBuilder, SelectQueryBuilder } from 'typeorm';
import { Brackets } from 'typeorm';

type Without<T, TU> = {
  [P in Exclude<keyof T, keyof TU>]?: never;
};

type XOR<T, TU> = T | TU extends Record<string, any>
  ? (Without<T, TU> & TU) | (Without<TU, T> & T)
  : T | TU;

export type ObjectLiteral = Record<string | symbol, any>;

export enum IJsonQueryOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum IJsonQueryOrderNulls {
  first = 'first',
  last = 'last',
}

export enum IJsonQueryOperator {
  between = 'between',
  like = 'like',
  in = 'in',
  notIn = '!in',
  notEqual = '!=',
  greater = '>',
  greaterOrEqual = '>=',
  less = '<',
  lessOrEqual = '<=',
}

export enum IJsonQueryJunction {
  and = 'and',
  or = 'or',
}

export interface IJsonQueryRelation {
  name: string;
  where?: IJsonQueryWhere;
}

type CurryXOR<T, TR extends unknown[]> = {
  0: [T];
  1: TR extends readonly [infer U, ...infer V] ? [...CurryXOR<XOR<T, U>, V>] : never;
}[TR extends readonly [infer _, ...infer __] ? 1 : 0];

type XOR_MULTIPLE<TR extends unknown[]> = {
  0: TR extends readonly [infer U] ? U : never;
  1: TR extends readonly [infer U, ...infer V] ? CurryXOR<U, V>[0] : never;
}[TR extends readonly [infer _, ...infer __] ? 1 : 0];

type NonEmptyArray<T> = [T, ...T[]];
type FilterValue = string | number | null;

export type FilterLess = { [IJsonQueryOperator.less]: FilterValue };

export type FilterLessOrEqual = { [IJsonQueryOperator.lessOrEqual]: FilterValue };

export type FilterGreater = { [IJsonQueryOperator.greater]: FilterValue };

export type FilterGreaterOrEqual = { [IJsonQueryOperator.greaterOrEqual]: FilterValue };

export type FilterCondition = XOR_MULTIPLE<
  [
    {
      [IJsonQueryOperator.notEqual]: FilterValue;
    },
    {
      [IJsonQueryOperator.between]: [FilterValue, FilterValue];
      isIncludes?: boolean;
    },
    {
      [IJsonQueryOperator.like]: string;
    },
    {
      [IJsonQueryOperator.in]: NonEmptyArray<FilterValue>;
    },
    {
      [IJsonQueryOperator.notIn]: NonEmptyArray<FilterValue>;
    },
    XOR_MULTIPLE<
      [
        FilterLess,
        FilterLessOrEqual,
        FilterGreater,
        FilterGreaterOrEqual,
        XOR<FilterLess, FilterLessOrEqual> & XOR<FilterGreater, FilterGreaterOrEqual>,
      ]
    >,
  ]
>;

export type FilterFields<TEntity = ObjectLiteral> = {
  [field in keyof TEntity]: string | number | null | FilterCondition;
};

export type IJsonQueryWhere<TEntity = ObjectLiteral> =
  | {
      [IJsonQueryJunction.and]?: NonEmptyArray<IJsonQueryWhere<TEntity>>;
      [IJsonQueryJunction.or]?: NonEmptyArray<IJsonQueryWhere<TEntity>>;
    }
  | FilterFields<Partial<TEntity>>;

type IJsonQueryOrderField = {
  order: keyof typeof IJsonQueryOrder;
  nulls?: keyof typeof IJsonQueryOrderNulls;
};

export interface IJsonQuery<TEntity = ObjectLiteral> {
  attributes?: (keyof TEntity)[];
  orderBy?: {
    [field in keyof TEntity]?: keyof typeof IJsonQueryOrder | IJsonQueryOrderField;
  };
  page?: number;
  pageSize?: number;
  relations?: string[] | IJsonQueryRelation[];
  where?: IJsonQueryWhere<TEntity>;
}

export interface IJsonQueryAuth<TEntity = ObjectLiteral>
  extends Omit<IJsonQuery<TEntity>, 'orderBy' | 'page' | 'pageSize' | 'relations'> {
  maxPageSize?: number;
  maxDeepRelation?: number;
  maxDeepWhere?: number;
  isDisableRelations?: boolean;
  isDisableAttributes?: boolean;
  isDisableOrderBy?: boolean;
  isDisablePagination?: boolean;
}

interface ITypeormJsonQueryArgs<TEntity = ObjectLiteral> {
  queryBuilder: SelectQueryBuilder<TEntity>;
  query?: IJsonQuery<TEntity>;
  authQuery?: IJsonQueryAuth<TEntity>;
}

export interface ITypeormJsonQueryOptions {
  defaultPageSize: number;
  maxPageSize: number; // 0 - disable (query all items), 200 - default value
  maxDeepRelation: number; // level1.level2.level3.etc...
  maxDeepWhere: number; // { and: [{ and: [{ and: [] }]}] } deep condition level
  isDisableRelations?: boolean;
  isDisableAttributes?: boolean;
  isDisableOrderBy?: boolean;
  isDisablePagination?: boolean;
}

interface IJsonOrderByResult {
  field: string;
  value: IJsonQueryOrder;
  nulls: 'NULLS FIRST' | 'NULLS LAST';
}

interface IJsonRelationResult {
  property: string;
  table: string;
  where?: string;
  parameters?: Record<string, any>;
}

// noinspection SuspiciousTypeOfGuard
/**
 * Convert json query to typeorm condition options
 */
class TypeormJsonQuery<TEntity = ObjectLiteral> {
  /**
   * Entity query builder
   */
  private readonly queryBuilder: ITypeormJsonQueryArgs<TEntity>['queryBuilder'];

  /**
   * Request json query
   */
  private query: IJsonQuery<TEntity>;

  /**
   * Authorization query
   */
  private authQuery: IJsonQuery<TEntity>;

  /**
   * Query options
   */
  private readonly options: ITypeormJsonQueryOptions = {
    defaultPageSize: 25,
    maxPageSize: 200,
    maxDeepRelation: 3,
    maxDeepWhere: 5,
    isDisableAttributes: false,
    isDisableRelations: false,
    isDisableOrderBy: false,
    isDisablePagination: false,
  };

  /**
   * We need this field for make unique query builder params
   * @see https://typeorm.io/#/select-query-builder/important-note-when-using-the-querybuilder
   * @private
   */
  private queryParamsCount = 0;

  /**
   * @constructor
   * @protected
   */
  protected constructor(
    queryBuilder: ITypeormJsonQueryArgs<TEntity>['queryBuilder'],
    options: Partial<ITypeormJsonQueryOptions>,
    query: ITypeormJsonQueryArgs<TEntity>['query'] = {},
    authQuery: ITypeormJsonQueryArgs<TEntity>['authQuery'] = {},
  ) {
    this.queryBuilder = queryBuilder;
    this.query = this.validate(query);
    this.authQuery = this.validateAuth(authQuery);

    // replace default options with authQuery or user defined
    Object.keys(this.options).forEach((name) => {
      const definedValue = authQuery[name] ?? options[name];

      if (definedValue !== undefined) {
        this.options[name] = definedValue;
      }
    });
  }

  /**
   * Parse client json query
   */
  static init<TEntity = ObjectLiteral>(
    { queryBuilder, query, authQuery }: ITypeormJsonQueryArgs<TEntity>,
    options: Partial<ITypeormJsonQueryOptions> = {},
  ): TypeormJsonQuery<TEntity> {
    return new this(queryBuilder, options, query, authQuery);
  }

  /**
   * Run json query validation
   * @private
   */
  private validate(query: IJsonQuery<TEntity>): IJsonQuery<TEntity> {
    if (typeof query !== 'object' || query === null) {
      throw new Error('Invalid json query.');
    }

    if (!['number', 'undefined'].includes(typeof query.page) || query.page === null) {
      throw new Error('Invalid json query: page.');
    }

    if (!['number', 'undefined'].includes(typeof query.pageSize) || query.pageSize === null) {
      throw new Error('Invalid json query: page size.');
    }

    return query;
  }

  /**
   * Validate auth query
   * @private
   */
  private validateAuth(query: IJsonQueryAuth<TEntity>): IJsonQueryAuth<TEntity> {
    this.validate(query);

    if (!['number', 'undefined'].includes(typeof query.maxPageSize) || query.maxPageSize === null) {
      throw new Error('Invalid auth json query: max page size.');
    }

    return query;
  }

  /**
   * Add alias to field
   * @private
   */
  private withFieldAlias(field: string, alias: string = this.queryBuilder.alias): string {
    return field.includes('.') ? field : [alias, field].join('.');
  }

  /**
   * Get query attributes
   */
  public getAttributes(attrs: IJsonQuery<TEntity>['attributes'] = []): string[] {
    if (this.options.isDisableAttributes) {
      return [];
    }

    const attributes = [
      ...(this.query.attributes || []),
      ...(this.authQuery.attributes || []),
      ...attrs,
    ].map((field) => {
      if (!field || typeof field !== 'string') {
        throw new Error('Invalid json query: some attribute has incorrect name.');
      }

      return this.withFieldAlias(field);
    });

    return [...new Set(attributes)];
  }

  /**
   * Get query sorting
   */
  public getOrderBy(orderBy?: IJsonQuery<TEntity>['orderBy']): IJsonOrderByResult[] {
    if (this.options.isDisableOrderBy) {
      return [];
    }

    let result = {};

    for (const orderCondition of [this.query.orderBy, orderBy]) {
      if (!orderCondition) {
        continue;
      }

      result = Object.entries(orderCondition).reduce((res, [field, sort]) => {
        const { order, nulls } = (
          typeof sort === 'object' && sort !== null ? sort : { order: sort }
        ) as IJsonQueryOrderField;

        if (!order || !(order in IJsonQueryOrder) || (nulls && !(nulls in IJsonQueryOrderNulls))) {
          throw new Error(`Invalid json query: (${field}) should have valid sort value.`);
        }

        let nullsOperator;

        switch (nulls) {
          case IJsonQueryOrderNulls.first:
            nullsOperator = 'NULLS FIRST';
            break;

          case IJsonQueryOrderNulls.last:
            nullsOperator = 'NULLS LAST';
        }

        const sortField = this.withFieldAlias(field);

        return {
          ...res,
          [sortField]: {
            field: sortField,
            value: order,
            nulls: nullsOperator,
          },
        };
      }, result);
    }

    return Object.values(result);
  }

  /**
   * Get current page
   */
  public getPage(page?: number): number {
    return ((page || this.query.page || 1) - 1) * this.getPageSize();
  }

  /**
   * Get page size
   */
  public getPageSize(size?: number): number {
    const { maxPageSize, defaultPageSize } = this.options;

    const currentPageSize = size ?? this.query.pageSize ?? defaultPageSize;

    // Disable page size (you can get all rows), or deny disable page size
    if (currentPageSize === 0) {
      return maxPageSize === 0 ? 0 : maxPageSize;
    }

    // check if page size not greater than max page size (if defined)
    return maxPageSize > 0 && currentPageSize > maxPageSize ? maxPageSize : currentPageSize;
  }

  /**
   * Get query relations
   */
  public getRelations(relations?: IJsonQuery<TEntity>['relations']): IJsonRelationResult[] {
    const { maxDeepRelation, isDisableRelations } = this.options;

    if (isDisableRelations) {
      return [];
    }

    return [...new Set([...(this.query.relations ?? []), ...(relations ?? [])])].map((relation) => {
      const { name, where } =
        typeof relation === 'object' && relation !== null
          ? relation
          : { name: relation, where: null };

      if (!name || typeof name !== 'string') {
        throw new Error('Invalid json query: some relation has incorrect name.');
      }

      if (name.split('.').length > maxDeepRelation) {
        throw new Error(`Invalid json query: relation "${name}" has reached maximum depth.`);
      }

      let whereCondition;
      let whereParameters;

      if (where) {
        const relationWhere = this.queryBuilder.connection
          .createQueryBuilder()
          .from(name, name)
          .where((qb) => this.parseCondition(where, qb, name));

        [whereCondition, whereParameters] = TypeormJsonQuery.qbWhereParse(relationWhere);
      }

      return {
        property: this.withFieldAlias(name),
        table: name,
        where: whereCondition,
        parameters: whereParameters,
      };
    });
  }

  /**
   * Parse query builder and return where condition & parameters
   */
  public static qbWhereParse<TEntity>(
    query: SelectQueryBuilder<TEntity>,
  ): [string, ObjectLiteral] | [] {
    const condition = query
      .getQuery()
      .split('WHERE ')[1]
      ?.split(/\s(limit|order|group|having)/i)?.[0];

    if (condition) {
      return [condition, query.getParameters()];
    }

    return [];
  }

  /**
   * Get unique parameter name
   * @private
   */
  private uniqueParameter(name: string): string {
    this.queryParamsCount++;

    return [name, this.queryParamsCount].join('_');
  }

  /**
   * Apply condition for field
   * @private
   */
  private applyCondition(
    qb: WhereExpressionBuilder,
    field: string,
    condition: FilterCondition,
  ): void {
    if (condition === undefined) {
      throw new Error(`Invalid json query: (${field}) should have value or condition.`);
    }

    const parameter = this.uniqueParameter(field);

    // equal
    if (['number', 'string'].includes(typeof condition) || condition === null) {
      qb.andWhere(`${field} = :${parameter}`, { [parameter]: condition });

      return;
    }

    // not equal
    if (condition.hasOwnProperty(IJsonQueryOperator.notEqual)) {
      const value = condition[IJsonQueryOperator.notEqual];

      // validation
      if (!['string', 'number'].includes(typeof value) && value !== null) {
        throw new Error(
          `Invalid json query: (${field}) "!=" should be one of [string,number,null].`,
        );
      }

      qb.andWhere(`${field} != :${parameter}`, { [parameter]: value });

      return;
    }

    // like
    if (condition.hasOwnProperty(IJsonQueryOperator.like)) {
      const value = condition[IJsonQueryOperator.like];

      // validation
      if (typeof value !== 'string') {
        throw new Error(`Invalid json query: (${field}) "like" should be string.`);
      }

      qb.andWhere(`${field} LIKE :${parameter}`, { [parameter]: value });

      return;
    }

    // in OR not in
    if (
      condition.hasOwnProperty(IJsonQueryOperator.in) ||
      condition.hasOwnProperty(IJsonQueryOperator.notIn)
    ) {
      const value = condition[IJsonQueryOperator.in] ?? condition[IJsonQueryOperator.notIn];
      const isNot = condition.hasOwnProperty(IJsonQueryOperator.notIn) ? ' NOT' : '';

      // validation
      if (!Array.isArray(value)) {
        throw new Error(`Invalid json query: (${field}) "in or !in" should be array.`);
      }

      qb.andWhere(`${field}${isNot} IN (:...${parameter})`, { [parameter]: value });

      return;
    }

    // comparison
    if (
      [
        IJsonQueryOperator.less,
        IJsonQueryOperator.lessOrEqual,
        IJsonQueryOperator.greater,
        IJsonQueryOperator.greaterOrEqual,
      ].some((property) => condition.hasOwnProperty(property))
    ) {
      const less =
        condition[IJsonQueryOperator.less] !== undefined
          ? { value: condition[IJsonQueryOperator.less], operator: '<' }
          : { value: condition[IJsonQueryOperator.lessOrEqual], operator: '<=' };
      const greater =
        condition[IJsonQueryOperator.greater] !== undefined
          ? { value: condition[IJsonQueryOperator.greater], operator: '>' }
          : { value: condition[IJsonQueryOperator.greaterOrEqual], operator: '>=' };

      // validation
      if (less.value === undefined && greater.value === undefined) {
        throw new Error(`Invalid json query: (${field}) comparison should have value.`);
      }

      // validation
      [less.value, greater.value].forEach((val) => {
        if (!['string', 'number', 'undefined'].includes(typeof val)) {
          throw new Error(`Invalid json query: (${field}) comparison invalid value.`);
        }
      });

      const expressions = [less, greater].map(
        ({ value, operator }, i) => value !== undefined && `${field} ${operator} :${parameter}${i}`,
      );
      const parameters = [less.value, greater.value].reduce((res, val, i) => {
        if (val === undefined) {
          return res;
        }

        return {
          ...res,
          [`${parameter}${i}`]: val,
        };
      }, {});

      qb.andWhere(expressions.filter(Boolean).join(' AND '), parameters);

      return;
    }

    // between
    if (condition.hasOwnProperty(IJsonQueryOperator.between)) {
      const values = condition[IJsonQueryOperator.between];
      // strict = true by default
      const isIncludes =
        ((typeof condition.isIncludes === 'boolean' ? condition.isIncludes : true) && '=') || '';

      // validation
      if (!values || values.length !== 2) {
        throw new Error(`Invalid json query: (${field}) "between" should have two value.`);
      }

      qb.andWhere(
        `${field} >${isIncludes} :${parameter}min AND ${field} <${isIncludes} :${parameter}max`,
        {
          [`${parameter}min`]: values[0],
          [`${parameter}max`]: values[1],
        },
      );

      return;
    }

    throw new Error(`Invalid json query: (${field}) have unknown condition.`);
  }

  /**
   * Convert json to typeorm condition
   * @private
   */
  private parseCondition(
    condition: IJsonQueryWhere,
    qb: WhereExpressionBuilder,
    alias?: string,
    deepLevel = 0,
  ): void {
    const { maxDeepWhere } = this.options;

    if (typeof condition !== 'object' || Array.isArray(condition)) {
      throw new Error('Invalid json query: invalid where condition.');
    }

    if (deepLevel > maxDeepWhere) {
      throw new Error(
        `Invalid json query: max deep "where" condition should not exceed ${maxDeepWhere}.`,
      );
    }

    Object.entries(condition).forEach(([field, value]) => {
      switch (field) {
        case IJsonQueryJunction.or:
        case IJsonQueryJunction.and:
          if (!Array.isArray(value)) {
            throw new Error(`Invalid json query: "${field}" should be array.`);
          }

          const subQb = new Brackets((nestedQb) => {
            value.forEach((nestedCondition) => {
              // build condition for one element from array
              const elementCondition = new Brackets((elementQb) =>
                this.parseCondition(nestedCondition, elementQb, alias, deepLevel + 1),
              );

              // join
              if (field === IJsonQueryJunction.and) {
                nestedQb.andWhere(elementCondition);
              } else {
                nestedQb.orWhere(elementCondition);
              }
            });
          });

          qb.andWhere(subQb);
          break;

        default:
          this.applyCondition(qb, this.withFieldAlias(field, alias), value);
      }
    });
  }

  /**
   * Get query conditions
   */
  public getWhere(where?: IJsonQueryWhere<TEntity>): Brackets[] {
    return [this.query.where, this.authQuery.where, where]
      .map((cond) => cond && new Brackets((qb) => this.parseCondition(cond, qb)))
      .filter(Boolean) as Brackets[];
  }

  /**
   * Convert json query to typeorm condition
   */
  public toQuery({
    attributes,
    orderBy,
    page,
    pageSize,
    relations,
    where,
  }: IJsonQuery<TEntity> = {}): ITypeormJsonQueryArgs<TEntity>['queryBuilder'] {
    const queryBuilder = this.queryBuilder.clone();
    const select = this.getAttributes(attributes);
    const sorting = this.getOrderBy(orderBy);
    const includes = this.getRelations(relations);
    const conditions = this.getWhere(where);

    if (select.length) {
      queryBuilder.select(select);
    }

    sorting.forEach(({ field, value, nulls }) => queryBuilder.addOrderBy(field, value, nulls));
    includes.forEach(({ property, table, where: relationWhere, parameters }) =>
      queryBuilder.leftJoinAndSelect(property, table, relationWhere, parameters),
    );
    conditions.forEach((condition) => queryBuilder.andWhere(condition));

    // pagination
    if (!this.options.isDisablePagination) {
      queryBuilder.take(this.getPageSize(pageSize));
      queryBuilder.skip(this.getPage(page));
    }

    return queryBuilder;
  }
}

export default TypeormJsonQuery;
