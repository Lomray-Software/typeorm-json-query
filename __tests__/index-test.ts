import type { IJsonQuery } from '@lomray/microservices-types';
import {
  JQFieldType,
  JQJunction,
  JQOperator,
  JQOrder,
  JQOrderNulls,
} from '@lomray/microservices-types';
import { expect } from 'chai';
import sinon from 'sinon';
import type { Brackets } from 'typeorm';
import TestEntity from '@__mocks__/entities/test-entity';
import TypeormMock from '@__mocks__/typeorm';
import TypeormJsonQuery from '@src/index';

describe('services/typeorm-json-query', () => {
  const repository = TypeormMock.entityManager.getRepository(TestEntity);
  const queryBuilder = repository.createQueryBuilder();
  const withAlias = (fields: string[] | string, alias = queryBuilder.alias) =>
    Array.isArray(fields)
      ? fields.map((field) => [alias, field].join('.'))
      : [alias, fields].join('.');
  const types = ['', null, {}]; // invalid types

  const commonQueryAttributes = ['id'] as IJsonQuery<TestEntity>['attributes'];
  const commonAuthQueryAttributes = ['param'] as IJsonQuery<TestEntity>['attributes'];
  const commonOrderBy = { id: JQOrder.DESC } as IJsonQuery<TestEntity>['orderBy'];
  const commonRelations = ['testRelation'] as IJsonQuery<TestEntity>['relations'];
  const defaultPageSize = 25;
  const defaultRelationQuery = {
    query: {
      groupBy: undefined,
      orderBy: undefined,
      page: undefined,
      pageSize: undefined,
    },
    isLateral: false,
    isSelect: true,
  };

  const commonInstance = TypeormJsonQuery.init({
    queryBuilder,
    query: {
      attributes: commonQueryAttributes,
      orderBy: commonOrderBy,
      relations: commonRelations,
      where: { id: 1 },
    },
    authQuery: {
      query: {
        attributes: commonAuthQueryAttributes,
        where: { param: 'authParam' },
      },
    },
  });
  const emptyInstance = TypeormJsonQuery.init({ queryBuilder });

  /**
   * Helper for convert bracket to where condition & parameters
   */
  const bracketToWhere = (bracket: Brackets) => {
    const qb = repository.createQueryBuilder().where(bracket);

    return TypeormJsonQuery.qbWhereParse(qb);
  };

  /**
   * Run parse condition for brackets
   */
  const runCondition = (brackets: Brackets[]) => {
    const qb = repository.createQueryBuilder();

    brackets.forEach((bracket) => bracket.whereFactory(qb));
  };

  beforeEach(() => {
    // reset query params count for a more accurate result
    emptyInstance['queryParamsCount'] = 0;
  });

  it('should create instance with: default options', () => {
    expect(emptyInstance).to.instanceof(TypeormJsonQuery);
  });

  it('should create instance with: auth query options', () => {
    const instance = TypeormJsonQuery.init({
      queryBuilder,
      authQuery: {
        options: {
          maxPageSize: 100,
        },
      },
    });

    expect(instance).to.have.property('options').have.property('maxPageSize').to.equal(100);
  });

  it('should create instance with: user options', () => {
    const instance = TypeormJsonQuery.init(
      {
        queryBuilder,
      },
      {
        defaultPageSize: 150,
      },
    );

    expect(instance).to.have.property('options').have.property('defaultPageSize').to.equal(150);
  });

  it('should throw error validation: query & authQuery', () => {
    const queries = ['query', 'authQuery'];
    const fields = [
      { field: '', msg: 'Invalid json query', types: ['', null] },
      { field: 'page', msg: 'Invalid json query: page.', types },
      { field: 'pageSize', msg: 'Invalid json query: page size.', types },
    ];

    for (const queryType of queries) {
      for (const { field, msg, types: typesField } of fields) {
        for (const type of typesField) {
          const query = field
            ? {
                [field]: type,
              }
            : type;

          const run = () =>
            TypeormJsonQuery.init({
              queryBuilder,
              // @ts-ignore
              [queryType]: queryType === 'query' ? query : { query },
            });

          expect(run).to.throw(msg);
        }
      }
    }
  });

  it('should return empty attributes: disable attributes', () => {
    const instance = TypeormJsonQuery.init(
      {
        queryBuilder,
        query: { attributes: ['id'] },
        authQuery: { query: { attributes: ['param'] } },
      },
      { isDisableAttributes: true },
    );

    // @ts-ignore
    const res = instance.getAttributes(['param2']);

    expect(res).to.deep.equal(['TestEntity.param', 'TestEntity.param2']);
  });

  it('should return attributes with aliases', () => {
    const attributes = commonInstance.getAttributes();

    expect(attributes).to.deep.equal(
      withAlias([
        ...(commonQueryAttributes as string[]),
        ...(commonAuthQueryAttributes as string[]),
      ]),
    );
  });

  it('should return attributes with aliases: omit duplicates', () => {
    const attr = `${queryBuilder.alias}.param` as unknown as 'param'; // attribute with alias
    const attributes = commonInstance.getAttributes([attr]);

    expect(attributes).to.deep.equal(
      withAlias([
        ...(commonQueryAttributes as string[]),
        ...(commonAuthQueryAttributes as string[]),
      ]),
    );
  });

  it('should throw error: invalid attribute names', () => {
    for (const type of types) {
      // @ts-ignore
      const result = () => commonInstance.getAttributes([type]);

      expect(result).to.throw('some attribute has incorrect name');
    }
  });

  it('should return attributes with deep relation aliases', () => {
    // @ts-ignore
    const attributes = commonInstance.getAttributes(['id', 'rel1.id', 'rel1.rel2.id']);

    expect(attributes).to.deep.equal([
      ...withAlias([
        ...(commonQueryAttributes as string[]),
        ...(commonAuthQueryAttributes as string[]),
      ]),
      'rel1.id',
      'rel1_rel2.id',
    ]);
  });

  it('should return empty group by: disable group by', () => {
    const instance = TypeormJsonQuery.init(
      {
        queryBuilder,
        query: { groupBy: ['id'] },
        authQuery: { query: { groupBy: ['param'] } },
      },
      { isDisableGroupBy: true },
    );

    // @ts-ignore
    const res = instance.getGroupBy(['param2']);

    expect(res).to.deep.equal(['TestEntity.param', 'TestEntity.param2']);
  });

  it('should return group by attributes with aliases', () => {
    const groupByAttr = commonInstance.getGroupBy(['id']);

    expect(groupByAttr).to.deep.equal(withAlias(['id']));
  });

  it('should throw error: invalid group by attribute names', () => {
    for (const type of types) {
      // @ts-ignore
      const result = () => commonInstance.getGroupBy([type]);

      expect(result).to.throw('some group by attribute has incorrect name.');
    }
  });

  it('should return empty order: disable orderBy', () => {
    const instance = TypeormJsonQuery.init(
      {
        queryBuilder,
        query: { orderBy: { id: JQOrder.DESC } },
        authQuery: { query: { orderBy: { param: JQOrder.DESC } } },
      },
      { isDisableOrderBy: true },
    );

    expect(instance.getOrderBy()).to.deep.equal([]);
  });

  it('should return orderBy with aliases', () => {
    const orderBy = commonInstance.getOrderBy();

    expect(orderBy).to.deep.equal([
      {
        field: withAlias('id'),
        value: JQOrder.DESC,
        nulls: undefined,
      },
    ]);
  });

  it('should return orderBy with used defined: prevent duplicates & with nullish', () => {
    const orderBy = commonInstance.getOrderBy({
      id: { order: JQOrder.ASC, nulls: JQOrderNulls.last },
      param: { order: JQOrder.ASC, nulls: JQOrderNulls.first },
    });

    expect(orderBy).to.deep.equal([
      {
        field: withAlias('id'),
        value: JQOrder.ASC,
        nulls: 'NULLS LAST',
      },
      {
        field: withAlias('param'),
        value: JQOrder.ASC,
        nulls: 'NULLS FIRST',
      },
    ]);
  });

  it('should throw error orderBy: validation failed', () => {
    const cases = [
      null,
      'unknown',
      { order: null },
      { order: 'unknown' },
      { order: JQOrder.DESC, nulls: 'unknown' },
    ];

    for (const type of cases) {
      const result = () =>
        // @ts-ignore
        commonInstance.getOrderBy({ id: type });

      expect(result).to.throw('should have valid sort value');
    }
  });

  it('should return default page', () => {
    const page = commonInstance.getPage();

    expect(page).to.equal(0);
  });

  it('should return user defined page', () => {
    const page = commonInstance.getPage(5);

    expect(page).to.equal(4 * defaultPageSize);
  });

  it('should return query defined page: default', () => {
    const instance = TypeormJsonQuery.init({ queryBuilder, query: { page: 2 } });
    const page = instance.toQuery().getSql();

    expect(page.endsWith('LIMIT 25 OFFSET 25')).to.true;
  });

  it('should return query defined page: custom', () => {
    const instance = TypeormJsonQuery.init({ queryBuilder, query: { page: 2, pageSize: 5 } });
    const page = instance.toQuery().getSql();

    expect(page.endsWith('LIMIT 5 OFFSET 5')).to.true;
  });

  it('should return default page size', () => {
    const pageSize = commonInstance.getPageSize();

    expect(pageSize).to.equal(defaultPageSize);
  });

  it('should return user defined page size', () => {
    const pageSize = commonInstance.getPageSize(100);

    expect(pageSize).to.equal(100);
  });

  it('should return page size: 0 (disable)', () => {
    const instance = TypeormJsonQuery.init(
      { queryBuilder, query: { pageSize: 0 } },
      { maxPageSize: 0 },
    );
    const pageSize = instance.getPageSize(0);

    expect(pageSize).to.equal(0);
  });

  it('should return query page size', () => {
    const instance = TypeormJsonQuery.init({ queryBuilder, query: { pageSize: 10 } });
    const pageSize = instance.toQuery().getSql();

    expect(pageSize.endsWith('LIMIT 10')).to.true;
  });

  it('should return max page size', () => {
    const instance = TypeormJsonQuery.init(
      { queryBuilder, query: { pageSize: 100 } },
      { maxPageSize: 10 },
    );
    const pageSize = instance.getPageSize();

    expect(pageSize).to.equal(10);
  });

  it('should return max page size: max page size not disabled', () => {
    const instance = TypeormJsonQuery.init(
      { queryBuilder, query: { pageSize: 0 } },
      { maxPageSize: 10 },
    );
    const pageSize = instance.getPageSize();

    expect(pageSize).to.equal(10);
  });

  it('should return parsed query builder where', () => {
    const qb = repository
      .createQueryBuilder()
      .where('id = :id', { id: 1 })
      .andWhere('param > :param', { param: 2 })
      .orderBy('id');
    const [condition, params] = TypeormJsonQuery.qbWhereParse(qb);

    expect(condition).to.equal('id = :id AND param > :param');
    expect(params).to.deep.equal({ id: 1, param: 2 });
  });

  it('should return parsed query builder where case #2', () => {
    const qb = repository
      .createQueryBuilder()
      .where('id = :id', { id: 1 })
      .andWhere('group > :param', { param: 2 })
      .orderBy('id');
    const [condition, params] = TypeormJsonQuery.qbWhereParse(qb);

    expect(condition).to.equal('id = :id AND group > :param');
    expect(params).to.deep.equal({ id: 1, param: 2 });
  });

  it('should return parsed query builder where case #3', () => {
    const qb = repository
      .createQueryBuilder()
      .where('id = :id', { id: 1 })
      .andWhere('group > :param', { param: 2 })
      .groupBy('param');
    const [condition, params] = TypeormJsonQuery.qbWhereParse(qb);

    expect(condition).to.equal('id = :id AND group > :param');
    expect(params).to.deep.equal({ id: 1, param: 2 });
  });

  it('should return parsed (empty) query builder where', () => {
    const qb = repository.createQueryBuilder().orderBy('id');
    const [condition, params] = TypeormJsonQuery.qbWhereParse(qb);

    expect(condition).to.undefined;
    expect(params).to.undefined;
  });

  it('should empty relations: disabled', () => {
    const instance = TypeormJsonQuery.init<TestEntity>(
      {
        queryBuilder,
        query: { relations: ['testRelation'] },
        // @ts-ignore
        authQuery: { query: { relations: ['otherRelation'] } },
      },
      { isDisableRelations: true },
    );

    // @ts-ignore
    const rel = instance.getRelations(['myRelation']);

    expect(rel.length).to.equal(2);
    expect(rel[0].alias).to.equal('otherRelation');
    expect(rel[1].alias).to.equal('myRelation');
  });

  it('should success return relations', () => {
    const relations = commonInstance.getRelations();

    expect(relations).to.deep.equal([
      {
        property: withAlias(commonRelations?.[0] as string),
        alias: commonRelations?.[0],
        where: undefined,
        parameters: undefined,
        ...defaultRelationQuery,
      },
    ]);
  });

  it('should success return relations with conditions', () => {
    const relations = emptyInstance.getRelations([
      { name: commonRelations?.[0], where: { id: 1 } },
    ] as any[]);

    expect(relations).to.deep.equal([
      {
        property: withAlias(commonRelations?.[0] as string),
        alias: commonRelations?.[0],
        where: 'testRelation.id = :testRelation.id_1',
        parameters: { 'testRelation.id_1': 1 },
        ...defaultRelationQuery,
      },
    ]);
  });

  it('should success return query with deep relations', () => {
    const relations = emptyInstance.getRelations([
      { name: 'rel1', where: { id: 1 } },
      { name: 'rel1.rel2', where: { id: 2 } },
    ] as any[]);

    expect(relations).to.deep.equal([
      {
        alias: 'rel1',
        parameters: {
          'rel1.id_1': 1,
        },
        property: 'TestEntity.rel1',
        where: 'rel1.id = :rel1.id_1',
        ...defaultRelationQuery,
      },
      {
        alias: 'rel1_rel2',
        parameters: {
          'rel1_rel2.id_2': 2,
        },
        property: 'rel1.rel2',
        where: 'rel1_rel2.id = :rel1_rel2.id_2',
        ...defaultRelationQuery,
      },
    ]);
  });

  it('should throw error: relation name is invalid', () => {
    const cases = ['', 2, {}, { name: null }, { name: '' }];

    for (const type of cases) {
      // @ts-ignore
      const result = () => commonInstance.getRelations([type]);

      expect(result).to.throw('relation has incorrect name');
    }
  });

  it('should throw error: max deep relation reached', () => {
    const result = () =>
      commonInstance.getRelations(['level1.level2.level3.level4.level5'] as any[]);

    expect(result).to.throw('reached maximum depth');
  });

  it('should success return relations without duplicates', () => {
    const relations = commonInstance.getRelations(['testRelation', { name: 'testRelation' }]);

    expect(relations).to.deep.equal([
      {
        property: withAlias(commonRelations?.[0] as string),
        alias: commonRelations?.[0],
        where: undefined,
        parameters: undefined,
        ...defaultRelationQuery,
      },
    ]);
  });

  it('should success return merged relations', () => {
    const relations = commonInstance.getRelations([
      { name: 'testRelation', where: { id: 1 }, groupBy: ['id'] },
      { name: 'testRelation', where: { id: 2 }, groupBy: ['id'] },
    ]);

    expect(relations).to.deep.equal([
      {
        property: withAlias(commonRelations?.[0] as string),
        alias: commonRelations?.[0],
        where: ' AND testRelation.id = :testRelation.id_1 AND testRelation.id = :testRelation.id_2',
        parameters: {
          'testRelation.id_1': 1,
          'testRelation.id_2': 2,
        },
        ...defaultRelationQuery,
        query: {
          ...defaultRelationQuery.query,
          groupBy: ['id'],
        },
      },
    ]);
  });

  it('should success return where condition: query & authQuery', () => {
    const [queryWhere, authQuery] = commonInstance.getWhere();

    expect(bracketToWhere(queryWhere)).to.deep.equal([
      '("TestEntity"."id" = :TestEntity.id_3)',
      { 'TestEntity.id_3': 1 },
    ]);
    expect(bracketToWhere(authQuery)).to.deep.equal([
      '("TestEntity"."param" = :TestEntity.param_4)',
      { 'TestEntity.param_4': 'authParam' },
    ]);
  });

  it('should throw error "where": invalid where condition', () => {
    const cases = [1, []];

    for (const type of cases) {
      // @ts-ignore
      const result = () => runCondition(emptyInstance.getWhere(type));

      expect(result).to.throw('invalid where condition');
    }
  });

  it('should throw error "where": max deep level reached', () => {
    const result = () =>
      runCondition(
        emptyInstance.getWhere({
          // deep level - 6 (max by default - 5)
          and: [{ and: [{ and: [{ and: [{ and: [{ and: [{ id: 1 }] }] }] }] }] }],
        }),
      );

    expect(result).to.throw('max deep "where" condition');
  });

  it('should throw error "where": junction should be array', () => {
    const cases = [{ and: {} }, { or: {} }, { and: 1 }, { or: '' }];

    for (const type of cases) {
      // @ts-ignore
      const result = () => runCondition(emptyInstance.getWhere(type));

      expect(result).to.throw('should be array');
    }
  });

  it('should success return where condition with junction operator', () => {
    const operators = [JQJunction.and, JQJunction.or];

    operators.forEach((operator) => {
      const condition = TypeormJsonQuery.init({ queryBuilder })
        .getWhere({
          [operator]: [{ id: 1 }, { id: 2 }],
        })
        .map((br) => bracketToWhere(br));

      expect(condition[0]).to.deep.equal([
        `((("TestEntity"."id" = :TestEntity.id_1) ${operator.toUpperCase()} ("TestEntity"."id" = :TestEntity.id_2)))`,
        { 'TestEntity.id_1': 1, 'TestEntity.id_2': 2 },
      ]);
    });
  });

  it('should throw error "where": invalid field value or condition', () => {
    const result = () => runCondition(emptyInstance.getWhere({ id: undefined }));

    expect(result).to.throw('should have value or condition');
  });

  it('should throw error "where": field have unknown condition', () => {
    const result = () =>
      // @ts-ignore
      runCondition(emptyInstance.getWhere({ id: { unknown: 'condition' } }));

    expect(result).to.throw('have unknown condition');
  });

  it('should apply where condition: "="', () => {
    const [result] = emptyInstance.getWhere({ id: { [JQOperator.equal]: 1 } });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" = :TestEntity.id_1)',
      { 'TestEntity.id_1': 1 },
    ]);
  });

  it('should apply where condition: "!="', () => {
    const [result] = emptyInstance.getWhere({ id: { [JQOperator.notEqual]: 1 } });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" != :TestEntity.id_1)',
      { 'TestEntity.id_1': 1 },
    ]);
  });

  it('should throw where condition: "!=" is invalid', () => {
    const result = () =>
      // @ts-ignore
      runCondition(emptyInstance.getWhere({ id: { [JQOperator.notEqual]: {} } }));

    expect(result).to.throw('"!=" should be one of');
  });

  it('should apply where condition: "like"', () => {
    const [result] = emptyInstance.getWhere({ id: { [JQOperator.like]: '%test$' } });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" LIKE :TestEntity.id_1)',
      { 'TestEntity.id_1': '%test$' },
    ]);
  });

  it('should apply where condition: "like" insensitive', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.like]: '%test$', insensitive: true },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" ILIKE :TestEntity.id_1)',
      { 'TestEntity.id_1': '%test$' },
    ]);
  });

  it('should throw where condition: "like" is invalid', () => {
    const result = () =>
      // @ts-ignore
      runCondition(emptyInstance.getWhere({ id: { [JQOperator.like]: null } }));

    expect(result).to.throw('"like" should be string');
  });

  it('should apply where condition: "in"', () => {
    const [result] = emptyInstance.getWhere({ id: { [JQOperator.in]: [1, 2] } });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" IN (:...TestEntity.id_1))',
      { 'TestEntity.id_1': [1, 2] },
    ]);
  });

  it('should apply where condition: "!in"', () => {
    const [result] = emptyInstance.getWhere({ id: { [JQOperator.notIn]: [1, 2] } });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" NOT IN (:...TestEntity.id_1))',
      { 'TestEntity.id_1': [1, 2] },
    ]);
  });

  it('should throw where condition: "in" or "!in" is invalid', () => {
    for (const operator of [JQOperator.in, JQOperator.notIn]) {
      const result = () =>
        // @ts-ignore
        runCondition(emptyInstance.getWhere({ id: { [operator]: null } }));
      const result2 = () =>
        // @ts-ignore
        runCondition(emptyInstance.getWhere({ id: { [operator]: [] } }));

      expect(result).to.throw('"in or !in" should be not empty array');
      expect(result2).to.throw('"in or !in" should be not empty array');
    }
  });

  it('should apply where condition: "between"', () => {
    const [result] = emptyInstance.getWhere({ id: { [JQOperator.between]: [1, 2] } });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" >= :TestEntity.id_1min AND "TestEntity"."id" <= :TestEntity.id_1max)',
      { 'TestEntity.id_1min': 1, 'TestEntity.id_1max': 2 },
    ]);
  });

  it('should apply where condition: "between" disable includes', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.between]: [1, 2], isIncludes: false },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" > :TestEntity.id_1min AND "TestEntity"."id" < :TestEntity.id_1max)',
      { 'TestEntity.id_1min': 1, 'TestEntity.id_1max': 2 },
    ]);
  });

  it('should throw where condition: "between" is invalid', () => {
    const cases = ['', [], [1], [1, 2, 3], {}, null];

    for (const type of cases) {
      const result = () =>
        // @ts-ignore
        runCondition(emptyInstance.getWhere({ id: { [JQOperator.between]: type } }));

      expect(result).to.throw('"between" should have two value');
    }
  });

  it('should apply where condition: "<"', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.less]: 1 },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" < :TestEntity.id_10)',
      { 'TestEntity.id_10': 1 },
    ]);
  });

  it('should apply where condition: "<="', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.lessOrEqual]: 1 },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" <= :TestEntity.id_10)',
      { 'TestEntity.id_10': 1 },
    ]);
  });

  it('should apply where condition: ">"', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.greater]: 1 },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" > :TestEntity.id_11)',
      { 'TestEntity.id_11': 1 },
    ]);
  });

  it('should apply where condition: ">="', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.greaterOrEqual]: 1 },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" >= :TestEntity.id_11)',
      { 'TestEntity.id_11': 1 },
    ]);
  });

  it('should apply where condition: combine ">=" and "<="', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.greaterOrEqual]: 2, [JQOperator.lessOrEqual]: 1 },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id" <= :TestEntity.id_10 AND "TestEntity"."id" >= :TestEntity.id_11)',
      { 'TestEntity.id_10': 1, 'TestEntity.id_11': 2 },
    ]);
  });

  it('should throw where condition: empty two comparison values for ">" and "<"', () => {
    const result = () =>
      runCondition(
        emptyInstance.getWhere({
          // @ts-ignore
          id: { [JQOperator.less]: undefined, [JQOperator.greater]: undefined },
        }),
      );

    expect(result).to.throw('comparison should have value');
  });

  it('should throw where condition: invalid comparison value "<"', () => {
    const result = () =>
      runCondition(
        emptyInstance.getWhere({
          // @ts-ignore
          id: { [JQOperator.less]: {} },
        }),
      );

    expect(result).to.throw('comparison invalid value');
  });

  it('should apply where condition: "IS NULL"', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.isNULL]: null },
    });

    expect(bracketToWhere(result)).to.deep.equal(['("TestEntity"."id" IS NULL)', {}]);
  });

  it('should apply where condition: "IS NOT NULL"', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.isNotNULL]: null },
    });

    expect(bracketToWhere(result)).to.deep.equal(['("TestEntity"."id" IS NOT NULL)', {}]);
  });

  it('should apply cast type to field', () => {
    const [result] = emptyInstance.getWhere({
      id: { [JQOperator.like]: '%test%', type: JQFieldType.text },
    });

    expect(bracketToWhere(result)).to.deep.equal([
      '("TestEntity"."id"::text LIKE :TestEntity.id_1)',
      { 'TestEntity.id_1': '%test%' },
    ]);
  });

  it('should throw error with invalid field cast type', () => {
    const result = () =>
      runCondition(
        emptyInstance.getWhere({
          // @ts-ignore
          id: { [JQOperator.like]: '%test%', type: 'invalid' },
        }),
      );

    expect(result).to.throw('field type cast "invalid" is invalid.');
  });

  it('should return right query', () => {
    const qbResult = TypeormJsonQuery.init({
      queryBuilder,
      query: { where: { id: 1 }, orderBy: { id: JQOrder.ASC }, groupBy: ['id'] },
      authQuery: { query: { where: { param: 'auth' } } },
    })
      .toQuery()
      .getQuery();

    expect(qbResult).to.equal(
      'SELECT "TestEntity"."id" AS "TestEntity_id", "TestEntity"."param" AS "TestEntity_param", "TestEntity"."testRelationId" AS "TestEntity_testRelationId" FROM "test_entity" "TestEntity" WHERE ("TestEntity"."id" = :TestEntity.id_1) AND ("TestEntity"."param" = :TestEntity.param_2) GROUP BY "TestEntity"."id" ORDER BY "TestEntity"."id" ASC LIMIT 25',
    );
  });

  it('should return right query: with attributes, relation and disabled pagination', () => {
    const qbResult = TypeormJsonQuery.init(
      {
        queryBuilder,
        query: {
          // eslint-disable-next-line sonarjs/no-duplicate-string
          attributes: ['id', 'testRelation.id'],
          relations: [{ name: 'testRelation', orderBy: { id: 'DESC' } }],
        },
      },
      { isDisablePagination: true },
    )
      .toQuery({ orderBy: { id: JQOrder.DESC } })
      .getQuery();

    expect(qbResult).to.equal(
      'SELECT "TestEntity"."id" AS "TestEntity_id", "testRelation"."id" AS "testRelation_id" FROM "test_entity" "TestEntity" LEFT JOIN "test_related_entity" "testRelation" ON "testRelation"."id"="TestEntity"."testRelationId" ORDER BY "TestEntity"."id" DESC',
    );
  });

  it('should return query and disable select relations', () => {
    const qb = queryBuilder.clone();
    const onlyJoin = sinon.spy(qb, 'leftJoin');
    const joinAndSelect = sinon.spy(qb, 'leftJoinAndSelect');
    const mockedQb = sinon.stub(queryBuilder, 'clone').returns(qb);

    TypeormJsonQuery.init({
      queryBuilder,
      query: {
        relations: [{ name: 'testRelation', isSelect: false }],
      },
    })
      .toQuery()
      .getQuery();

    mockedQb.restore();

    expect(onlyJoin).to.calledOnce;
    expect(joinAndSelect).to.not.calledOnce;
  });

  it('should return right sql query with disabled lateral joins', () => {
    const qbResult = TypeormJsonQuery.init(
      {
        queryBuilder,
        query: {
          relations: [{ name: 'testRelation', orderBy: { id: 'DESC' }, isLateral: true }],
        },
      },
      { isLateralJoins: false },
    )
      .toQuery()
      .getQuery();

    expect(qbResult).to.equal(
      'SELECT "TestEntity"."id" AS "TestEntity_id", "TestEntity"."param" AS "TestEntity_param", "TestEntity"."testRelationId" AS "TestEntity_testRelationId", "testRelation"."id" AS "testRelation_id", "testRelation"."demo" AS "testRelation_demo" FROM "test_entity" "TestEntity" LEFT JOIN "test_related_entity" "testRelation" ON "testRelation"."id"="TestEntity"."testRelationId"',
    );
  });

  it('should return right sql query with lateral joins after clone qb', () => {
    const qbResult = TypeormJsonQuery.init({
      queryBuilder,
      query: {
        relations: [{ name: 'testRelation', orderBy: { id: 'DESC' }, isLateral: true }],
      },
    })
      .toQuery()
      .clone()
      .getQuery();

    expect(qbResult).to.equal(
      'SELECT "TestEntity"."id" AS "TestEntity_id", "TestEntity"."param" AS "TestEntity_param", "TestEntity"."testRelationId" AS "TestEntity_testRelationId", "testRelation"."id" AS "testRelation_id", "testRelation"."demo" AS "testRelation_demo" FROM "test_entity" "TestEntity" LEFT JOIN LATERAL (SELECT * FROM "test_related_entity" WHERE "id"="TestEntity"."testRelationId" ORDER BY "id" DESC LIMIT 50) "testRelation" ON TRUE',
    );
  });

  it('should return right sql query without lateral joins if it join alias contains in where clause', () => {
    const qbResult = TypeormJsonQuery.init({
      queryBuilder,
      query: {
        relations: [{ name: 'testRelation', orderBy: { id: 'DESC' }, isLateral: true }],
        where: {
          'testRelation.id': 1,
        },
      },
    })
      .toQuery()
      .getQuery();

    expect(qbResult).to.equal(
      'SELECT "TestEntity"."id" AS "TestEntity_id", "TestEntity"."param" AS "TestEntity_param", "TestEntity"."testRelationId" AS "TestEntity_testRelationId", "testRelation"."id" AS "testRelation_id", "testRelation"."demo" AS "testRelation_demo" FROM "test_entity" "TestEntity" LEFT JOIN "test_related_entity" "testRelation" ON "testRelation"."id"="TestEntity"."testRelationId" WHERE ("testRelation"."id" = :testRelation.id_1)',
    );
  });

  it('should return right sql query with field value type - field', () => {
    const qbResult = TypeormJsonQuery.init({
      queryBuilder,
      query: {
        relations: [{ name: 'testRelation' }],
        where: {
          id: { '=': 'testRelation.id', isField: true },
          param: { '!=': 'testRelation.id', isField: true },
        },
      },
    })
      .toQuery()
      .getQuery();

    expect(qbResult).to.equal(
      'SELECT "TestEntity"."id" AS "TestEntity_id", "TestEntity"."param" AS "TestEntity_param", "TestEntity"."testRelationId" AS "TestEntity_testRelationId", "testRelation"."id" AS "testRelation_id", "testRelation"."demo" AS "testRelation_demo" FROM "test_entity" "TestEntity" LEFT JOIN "test_related_entity" "testRelation" ON "testRelation"."id"="TestEntity"."testRelationId" WHERE ("TestEntity"."id" = "testRelation"."id" AND "TestEntity"."param" != "testRelation"."id")',
    );
  });

  it('should throw validation error: field value type wrong value', () => {
    const qbResult = TypeormJsonQuery.init({
      queryBuilder,
      query: {
        relations: [{ name: 'testRelation' }],
        where: {
          id: { '=': 1, isField: true },
        },
      },
    });

    expect(() => qbResult.toQuery()).to.throw(
      'Invalid json query: field value type or value is invalid.',
    );
  });
});
