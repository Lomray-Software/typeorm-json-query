import type {
  IJsonQuery,
  ObjectLiteral,
  IJsonQueryOrderField,
  TFilterCondition,
  IJsonQueryWhere,
} from '@lomray/microservices-types';
import {
  JQOrder,
  JQOperator,
  JQOrderNulls,
  JQFieldType,
  JQJunction,
} from '@lomray/microservices-types';
import type { WhereExpressionBuilder, SelectQueryBuilder } from 'typeorm';
import { Brackets } from 'typeorm';

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

export interface ITypeormJsonQueryArgs<TEntity = ObjectLiteral> {
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
  isDisableGroupBy?: boolean;
  isDisablePagination?: boolean;
}

export interface IJsonOrderByResult {
  field: string;
  value: JQOrder;
  nulls: 'NULLS FIRST' | 'NULLS LAST';
}

export interface IJsonRelationResult {
  property: string;
  alias: string;
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
    maxPageSize: 100,
    maxDeepRelation: 4,
    maxDeepWhere: 5,
    isDisableAttributes: false,
    isDisableRelations: false,
    isDisableOrderBy: false,
    isDisableGroupBy: false,
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
    // for relation
    if (field.includes('.')) {
      // '1.2.3.4' => '123.4'
      return field.replace(/[.](?=.*[.])/g, '_');
    }

    // for entity
    return [alias, field].join('.');
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

        if (!order || !(order in JQOrder) || (nulls && !(nulls in JQOrderNulls))) {
          throw new Error(`Invalid json query: (${field}) should have valid sort value.`);
        }

        let nullsOperator;

        switch (nulls) {
          case JQOrderNulls.first:
            nullsOperator = 'NULLS FIRST';
            break;

          case JQOrderNulls.last:
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
   * Get query group by attributes
   */
  public getGroupBy(attrs: IJsonQuery<TEntity>['groupBy'] = []): string[] {
    if (this.options.isDisableGroupBy) {
      return [];
    }

    const attributes = [
      ...(this.query.groupBy || []),
      ...(this.authQuery.groupBy || []),
      ...attrs,
    ].map((field) => {
      if (!field || typeof field !== 'string') {
        throw new Error('Invalid json query: some group by attribute has incorrect name.');
      }

      return this.withFieldAlias(field);
    });

    return [...new Set(attributes)];
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
      const alias = name.replace(/\./g, '_');

      if (where) {
        const relationWhere = this.queryBuilder.connection
          .createQueryBuilder()
          .from(name, alias)
          .where((qb) => this.parseCondition(where, qb, alias));

        [whereCondition, whereParameters] = TypeormJsonQuery.qbWhereParse(relationWhere);
      }

      return {
        property: this.withFieldAlias(name),
        alias,
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
   * Add quotes to field
   * @private
   */
  private static quoteColumn(field: string): string {
    return field
      ?.split('.')
      .map((part) => `"${part}"`)
      .join('.');
  }

  /**
   * Apply cast to field
   * @private
   */
  private static getCastField(field: string, options: TFilterCondition): string {
    if (typeof options !== 'object' || options === null || !options?.type) {
      return field;
    }

    const { type } = options;

    if (!(type in JQFieldType)) {
      throw new Error(`Invalid json query: field type cast "${type}" is invalid.`);
    }

    return `${TypeormJsonQuery.quoteColumn(field)}::${type}`;
  }

  /**
   * Apply condition for field
   * @private
   */
  private applyCondition(
    qb: WhereExpressionBuilder,
    field: string,
    condition: TFilterCondition,
  ): void {
    if (condition === undefined) {
      throw new Error(`Invalid json query: (${field}) should have value or condition.`);
    }

    const parameter = this.uniqueParameter(field);
    const castField = TypeormJsonQuery.getCastField(field, condition);

    // equal
    if (
      ['number', 'string'].includes(typeof condition) ||
      condition === null ||
      condition.hasOwnProperty(JQOperator.equal)
    ) {
      const value = condition?.[JQOperator.equal] ?? condition;

      qb.andWhere(`${castField} = :${parameter}`, {
        [parameter]: value,
      });

      return;
    }

    // not equal
    if (condition.hasOwnProperty(JQOperator.notEqual)) {
      const value = condition[JQOperator.notEqual];

      // validation
      if (!['string', 'number'].includes(typeof value) && value !== null) {
        throw new Error(
          `Invalid json query: (${field}) "!=" should be one of [string,number,null].`,
        );
      }

      qb.andWhere(`${castField} != :${parameter}`, {
        [parameter]: value,
      });

      return;
    }

    // like
    if (condition.hasOwnProperty(JQOperator.like)) {
      const value = condition[JQOperator.like];

      // validation
      if (typeof value !== 'string') {
        throw new Error(`Invalid json query: (${field}) "like" should be string.`);
      }

      const operator = condition?.insensitive ? 'ILIKE' : 'LIKE';

      qb.andWhere(`${castField} ${operator} :${parameter}`, {
        [parameter]: value,
      });

      return;
    }

    // in OR not in
    if (condition.hasOwnProperty(JQOperator.in) || condition.hasOwnProperty(JQOperator.notIn)) {
      const value = condition[JQOperator.in] ?? condition[JQOperator.notIn];
      const isNot = condition.hasOwnProperty(JQOperator.notIn) ? ' NOT' : '';

      // validation
      if (!Array.isArray(value)) {
        throw new Error(`Invalid json query: (${field}) "in or !in" should be array.`);
      }

      qb.andWhere(`${castField}${isNot} IN (:...${parameter})`, {
        [parameter]: value,
      });

      return;
    }

    // comparison
    if (
      [JQOperator.less, JQOperator.lessOrEqual, JQOperator.greater, JQOperator.greaterOrEqual].some(
        (property) => condition.hasOwnProperty(property),
      )
    ) {
      const less =
        condition[JQOperator.less] !== undefined
          ? { value: condition[JQOperator.less], operator: '<' }
          : { value: condition[JQOperator.lessOrEqual], operator: '<=' };
      const greater =
        condition[JQOperator.greater] !== undefined
          ? { value: condition[JQOperator.greater], operator: '>' }
          : { value: condition[JQOperator.greaterOrEqual], operator: '>=' };

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
        ({ value, operator }, i) =>
          value !== undefined && `${castField} ${operator} :${parameter}${i}`,
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
    if (condition.hasOwnProperty(JQOperator.between)) {
      const values = condition[JQOperator.between];
      // strict = true by default
      const isIncludes =
        ((typeof condition.isIncludes === 'boolean' ? condition.isIncludes : true) && '=') || '';

      // validation
      if (!values || values.length !== 2) {
        throw new Error(`Invalid json query: (${field}) "between" should have two value.`);
      }

      qb.andWhere(
        `${castField} >${isIncludes} :${parameter}min AND ${castField} <${isIncludes} :${parameter}max`,
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
        case JQJunction.or:
        case JQJunction.and:
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
              if (field === JQJunction.and) {
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
    relations,
    where,
    orderBy,
    groupBy,
    page,
    pageSize,
  }: IJsonQuery<TEntity> = {}): ITypeormJsonQueryArgs<TEntity>['queryBuilder'] {
    const queryBuilder = this.queryBuilder.clone();
    const select = this.getAttributes(attributes);
    const includes = this.getRelations(relations);
    const conditions = this.getWhere(where);
    const sorting = this.getOrderBy(orderBy);
    const groupByAttr = this.getGroupBy(groupBy);

    if (select.length) {
      queryBuilder.select(select);
    }

    sorting.forEach(({ field, value, nulls }) => queryBuilder.addOrderBy(field, value, nulls));
    includes.forEach(({ property, alias, where: relationWhere, parameters }) =>
      queryBuilder.leftJoinAndSelect(property, alias, relationWhere, parameters),
    );
    conditions.forEach((condition) => queryBuilder.andWhere(condition));
    groupByAttr.forEach((field) => queryBuilder.addGroupBy(field));

    // pagination
    if (!this.options.isDisablePagination) {
      queryBuilder.take(this.getPageSize(pageSize));
      queryBuilder.skip(this.getPage(page));
    }

    return queryBuilder;
  }
}

export default TypeormJsonQuery;
