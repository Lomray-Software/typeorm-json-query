# TypeORM JSON Query

### Converting JSON query to TypeORM query builder.

![npm](https://img.shields.io/npm/v/@lomray/typeorm-json-query)
![GitHub](https://img.shields.io/github/license/Lomray-Software/typeorm-json-query)
![GitHub package.json dependency version (dev dep on branch)](https://img.shields.io/github/package-json/dependency-version/Lomray-Software/typeorm-json-query/dev/typescript/master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_typeorm-json-query&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_typeorm-json-query)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_typeorm-json-query&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_typeorm-json-query)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_typeorm-json-query&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_typeorm-json-query)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_typeorm-json-query&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_typeorm-json-query)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_typeorm-json-query&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_typeorm-json-query)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_typeorm-json-query&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_typeorm-json-query)

## Fit and versions

`@lomray/typeorm-json-query` turns a JSON filter into a TypeORM select query.
Use it when a server already owns the entity definitions and query builder.
It does not provide an HTTP server, entity permissions, or database migrations.
Validate allowed fields and relations at your application boundary before accepting user queries.

Release `2.7.0` requires **TypeORM 0.2.41**. It is not a TypeORM 0.3 DataSource adapter.
The package ships CommonJS and declarations. Import `IJsonQuery` from
`@lomray/microservices-types`, not from this package.

## Runnable local example

This example creates an in-memory database, filters one row, and closes the connection.
SQL.js is only the example's database driver, not a requirement for every application.

```bash
npm install @lomray/typeorm-json-query@2.7.0 typeorm@0.2.41 sql.js@1.8.0 reflect-metadata@0.1.13
```

Save as `example.cjs` and run `node example.cjs`:

```javascript
require('reflect-metadata');
const TypeormJsonQuery = require('@lomray/typeorm-json-query');
const { createConnection, EntitySchema } = require('typeorm');

async function main() {
  const Item = new EntitySchema({
    name: 'Item',
    columns: {
      id: { type: Number, primary: true },
      name: { type: String },
    },
  });
  const connection = await createConnection({
    type: 'sqljs', entities: [Item], synchronize: true,
  });
  try {
    const repository = connection.getRepository(Item);
    await repository.save({ id: 1, name: 'example' });
    const query = TypeormJsonQuery.init({
      queryBuilder: repository.createQueryBuilder('item'),
      query: { attributes: ['id', 'name'], where: { id: 1 }, pageSize: 10 },
    }, { isLateralJoins: false, distinctType: 'all' });
    console.log(await query.toQuery().getMany());
  } finally {
    await connection.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
```

`synchronize: true` is for this disposable database only. Use your application's migration policy for persisted data.
The defaults enable PostgreSQL lateral joins and PostgreSQL distinct handling;
this SQLite example explicitly disables lateral joins and uses ordinary DISTINCT.
It does not establish support for PostgreSQL-only features on other databases.

## Query contract

`init({ queryBuilder, query, authQuery }, options)` creates a converter.
`toQuery()` returns a cloned builder; call a TypeORM execution method such as `getMany()` yourself.
Create a fresh converter and builder per request. `authQuery` is a server-supplied restriction,
not a replacement for authentication or an excuse to pass client input as authorization.

See [the implementation](src/index.ts) and [query tests](__tests__/index-test.ts)
for operators, ordering, relation controls and pagination limits.

## Documentation checks

`npm test` includes README contract checks. To execute the example against a release, install the pinned example dependencies in a separate directory and run `DOCS_FIXTURE_DIR=/absolute/path/to/fixture node scripts/check-readme-example.cjs`. The check runs the actual README block with an in-memory database.
