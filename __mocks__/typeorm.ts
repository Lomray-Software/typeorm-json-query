/* eslint-disable @typescript-eslint/no-unsafe-argument */
import rewiremock from 'rewiremock';
import sinon from 'sinon';
import { getConnectionManager, EntityManager } from 'typeorm';

const sandbox = sinon.createSandbox();

/**
 * Replace entity manager methods with stub methods
 * (prevent trying to create connection and original requests to database)
 */
class EntityManagerMock extends EntityManager {
  stubReturns() {
    this.getRepository = sandbox.stub().callsFake((repo) => super.getRepository(repo));
    this.getCustomRepository = sandbox.stub().callsFake((repo) => super.getCustomRepository(repo));
  }

  // @ts-ignore
  constructor(...args) {
    // @ts-ignore
    super(...args);
    this.stubReturns();
  }

  reset() {
    this.stubReturns();
  }
}

// Create fake connection
const fakeConnection = getConnectionManager().create({
  type: 'postgres',
  entities: ['__mocks__/entities/*.ts'],
  synchronize: true,
  logging: false,
});

// @ts-ignore
void fakeConnection.buildMetadatas();

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/unbound-method
const prevFindMetaData = fakeConnection.findMetadata;

// @ts-ignore
fakeConnection.findMetadata = function (target) {
  let metadata = prevFindMetaData.call(fakeConnection, target);

  /**
   * We need this implementation because when tests run with --watch flag,
   * every rerun tests add new entities to 'getMetadataArgsStorage'
   * and we lose links to class
   */
  if (!metadata) {
    metadata = this.entityMetadatas.find(
      (md) =>
        // @ts-ignore
        md.target.name === target.name,
    );
  }

  return metadata;
};

type TEntityManagerMock = InstanceType<typeof EntityManagerMock>;

const entityManager = new EntityManagerMock(fakeConnection) as EntityManagerMock & {
  [key in keyof TEntityManagerMock]: TEntityManagerMock[key] extends (...args: any[]) => any
    ? sinon.SinonStub
    : TEntityManagerMock[key];
};

sandbox.stub(fakeConnection, 'manager').value(entityManager);

const stubs = {
  createConnection: sandbox.stub().resolves(fakeConnection),
};

const prevReset = sandbox.reset.bind(sandbox);

sandbox.reset = () => {
  prevReset();
  stubs.createConnection.resolves(fakeConnection);
  sandbox.stub(fakeConnection, 'manager').value(entityManager);
  entityManager.reset();
};

const Typeorm = {
  sandbox,
  stubs,
  entityManager,
  mock: rewiremock('typeorm').callThrough().with(stubs) as any,
};

export default Typeorm;
