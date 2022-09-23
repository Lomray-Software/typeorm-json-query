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

## Install
```bash
npm i --save @lomray/typeorm-json-query
```

## Usage

Pass request JSON query to `TypeormJsonQuery`.

__Request:__
```http request
POST http://127.0.0.1:3000
Content-Type: application/json

{
  "attributes": ["id", "param"], // or empty for select all
  "orderBy": { "id": "DESC", { "param": { "order": "ASC", "nulls": "last" } } },
  "relations": ["demo"],
  "where": { "id": 1, "or": [{ "param": "hello" }, { "param": "world" }] },
}
```

__Server implementation:__
```typescript
import TypeormJsonQuery from '@lomray/typeorm-json-query';
import express from 'express';
import { getRepository } from 'typeorm';
import TestEntity from './entities/test-entity';

express()
  .get('/demo-endpoint', (req, res) => {
    const jsonQuery = req.body;
    const typeormQuery = TypeormJsonQuery.init({
      queryBuilder: getRepository(TestEntity).createQueryBuilder(),
      query: jsonQuery,
    });
    
    console.log(typeormQuery.toQuery().getSql());

    res.send('Ok.');
  });
```

__Also, you can use `IJsonQuery` interface for support build JSON query on `client` side:__ 
```typescript
import { IJsonQuery } from '@lomray/typeorm-json-query';
import ITestEntity from './interfaces/i-test-entity';
import axios from 'axios';

const body: IJsonQuery<ITestEntity> = {
  relations: [{ name: 'test', where: { id: 1 } }],
  where: { and: [{ id: { '<': 5 } }, { param: { like: '%hello%' } }] },
};

axios.request({
  method: 'POST',
  body,
});
```

Check out *__tests__/index-test.ts* or *src/index.ts* for more info.
