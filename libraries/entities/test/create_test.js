const helper = require('./helper');
const { Database, Schema } = require('taskcluster-lib-postgres');
const { Entity } = require('taskcluster-lib-entities');
const path = require('path');
const assert = require('assert').strict;


helper.dbSuite(path.basename(__filename), function() {
  let db;

  teardown(async function() {
    if (db) {
      try {
        await db.close();
      } finally {
        db = null;
      }
    }
  });

  suite('create', function() {
    test('create entity', async function() {
      const schema = Schema.fromDbDirectory(path.join(__dirname, 'db'));
      const serviceName = 'test-entities';

      await helper.withDb({ schema, serviceName });

      const properties = {
        taskId: 'string',
        provisionerId: 'string',
        workerType: 'string'
      };
      const entity = Entity.configure({
        partitionKey: 'taskId',
        rowKey: 'task',
        properties,
      });

      assert.equal(entity.properties, properties);
      assert.equal(entity.rowKey, 'task');
      assert.equal(entity.partitionKey, 'taskId');
    });
  });
  test('create entry', async function() {
    const schema = Schema.fromDbDirectory(path.join(__dirname, 'db'));
    const serviceName = 'test-entities';

    db = await helper.withDb({ schema, serviceName });

    const properties = {
      taskId: 'string',
      provisionerId: 'string',
      workerType: 'string'
    };
    const entity = Entity.configure({
      partitionKey: 'taskId',
      rowKey: 'task',
      properties,
    });
    const entry = {
      taskId: 'taskId',
      provisionerId: 'provisionerId',
      workerType: 'string',
    };

    entity.setup({ tableName: 'test_entities', db, serviceName });

    await entity.create(entry);

    const result = await db.procs['get_entity'](entity.calculateId(entry));

    assert.equal(result.length, 1);
    assert.equal(result[0].id, entity.calculateId(entry));
    assert.deepEqual(result[0].value, entry);
    assert(result[0].etag);
    assert(result[0].version);
  });
  test('create entry (overwriteIfExists)', async function() {
    const schema = Schema.fromDbDirectory(path.join(__dirname, 'db'));
    const serviceName = 'test-entities';

    db = await helper.withDb({ schema, serviceName });

    const properties = {
      taskId: 'string',
      provisionerId: 'string',
      workerType: 'string'
    };
    const entity = Entity.configure({
      partitionKey: 'taskId',
      rowKey: 'task',
      properties,
    });
    let entry = {
      taskId: 'taskId',
      provisionerId: 'provisionerId',
      workerType: 'string',
    };

    entity.setup({ tableName: 'test_entities', db, serviceName });

    await entity.create(entry);

    const old = await db.procs['get_entity'](entity.calculateId(entry));

    entry = {
      ...entry,
      workerType: 'foo',
    };

    await entity.create(entry, true);

    const result = await db.procs['get_entity'](entity.calculateId(entry));

    assert.equal(old.length, 1);
    assert.equal(result.length, 1);
    assert.equal(old[0].value.workerType, 'string');
    assert.equal(result[0].value.workerType, 'foo');
    assert.deepEqual(result[0].value, entry);
    assert.notEqual(old[0].etag, result[0].etag);
  });
  test('create entry (won\'t overwrite)', async function () {
    const schema = Schema.fromDbDirectory(path.join(__dirname, 'db'));
    const serviceName = 'test-entities';

    db = await helper.withDb({ schema, serviceName });

    const properties = {
      taskId: 'string',
      provisionerId: 'string',
      workerType: 'string'
    };
    const entity = Entity.configure({
      partitionKey: 'taskId',
      rowKey: 'task',
      properties,
    });
    let entry = {
      taskId: 'taskId',
      provisionerId: 'provisionerId',
      workerType: 'string',
    };

    entity.setup({ tableName: 'test_entities', db, serviceName });

    await entity.create(entry);

    await db.procs['get_entity'](entity.calculateId(entry));

    entry = {
      ...entry,
      workerType: 'foo',
    };

    assert.rejects(
      async () => {
        await entity.create(entry, false);
      },
      // already exists
      err => err.code === '23505'
    );
  })
});
