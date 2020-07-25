import path from 'path'
import { AuthInput } from '../../src/globalTypes'
import { addValidationToContract, registerRestMethods, elastic } from '../../src'
import { generateContract, getMethods, Contracts } from './common'

import * as get from './unauthenticated/get'
import * as post from './unauthenticated/post'
import * as put from './unauthenticated/put'
import * as patch from './unauthenticated/patch'
import * as uaDel from './unauthenticated/delete'

import * as authGet from './authenticated/get'
import * as authPatch from './authenticated/patch'
import * as authPut from './authenticated/put'
import * as authDel from './authenticated/delete'

describe('elasticsearch data connector test', () => {
  const schemaFilePath = path.join(__dirname, '../../example/elasticsearch_text_search_example.json')
  let indexName:string
  let contract:any
  let m:Contracts

  beforeAll(async () => {
    indexName = 'test-' + Date.now()

    if (!process.env.ELASTIC_HOST ||
      ((!process.env.ELASTIC_USER_NAME ||
      !process.env.ELASTIC_PASSWORD) &&
      !process.env.ELASTIC_UNAUTHENTICATED)) {
      throw new Error('elasticsearch credentials need to be set in ENV variables for this test to work')
    }
  })

  beforeEach(async () => {
    await elastic.client().indices.create({
      index: indexName
      /* this is not needed for the local docker testing */
      // wait_for_active_shards: 'all'
    })
    return ''
  })

  afterEach(async () => {
    await elastic.client().indices.delete({ index: 'test*' })
    return ''
  })

  describe('without any authentication', () => {
    beforeAll(async () => {
      await generateContract(schemaFilePath, 'test-elastic', (input) => {
        input.preferredImplementation = {
          type: 'elasticsearch',
          index: indexName
        }
        return input
      })
      // @ts-ignore
      const inputs = await import('../temp/test-elastic-server')
      contract = registerRestMethods(addValidationToContract(inputs.contracts))
      m = getMethods(contract)
    })

    describe('get empty', () => {
      it('will return 404 when the element is requested by id', async () => {
        await get.expectNotFound(m.get.handle)
      })

      it('will get empty sets when there are no params or multiple ids requested', async () => {
        await get.expectEmptyForNonMatchingInput(m.get.handle)
        await get.expectEmptyWhenNoRecordsPresent(m.get.handle)
      })

      it('will get empty sets when searching for text', async () => {
        await get.expectEmptyWithTextSearch(m.get.handle)
      })
    })

    describe('post', () => {
      it('can post items and get all with empty arguments', async () => {
        await post.postAndGetRecordsByEmptyGet(m.post, m.get.handle, {})
      })

      it('can get all posted items by id, one by one', async () => {
        await post.postAndGetRecordsByIdParam(m.post, m.get.handle, {})
      })

      it('can get all posted items by id array', async () => {
        await post.postAndGetRecordsByIdArray(m.post, m.get.handle, {})
      })

      it('can get some of the posted items by id array', async () => {
        await post.postAndGetSomeRecordsByIdArray(m.post, m.get.handle, {})
      })

      it('Text search for the first generated, and it should be the first result returned', async () => {
        // So this should look for a string field that is not the id
      })

      it('will return 404 when the element is requested by id', async () => {
        await post.postRecords(m.post, {})
        await get.expectNotFound(m.get.handle)
      })

      it('will get empty sets when there are no params or multiple ids requested', async () => {
        await post.postRecords(m.post, {})
        await get.expectEmptyForNonMatchingInput(m.get.handle)
      })

      it('Gets available records, ignores non existent ones when an array of ids is supplied', async () => {
        await post.postAndGetAvailableIdsIgnoringWrong(m.post, m.get.handle, {})
      })
      it('can perform text search', async () => {
        await post.postAndGetByTextSearch(m.post, m.get.handle, {})
      })

      it('rejects re-post', async () => {
        await post.postAndRejectRePost(m.post, m.get.handle, {})
      })

      it('rejects post with same id', async () => {
        await post.postAndRejectPostWithSameId(m.post, m.get.handle, {})
      })
    })

    describe('patch', () => {
      it('can patch item and verify that only that one record changed', async () => {
        await patch.canPatch(m.post, m.patch, m.get.handle, {})
      })

      it('can not patch non existing record', async () => {
        await patch.cantPatchNonExistent(m.post, m.patch, m.get.handle, {})
      })

      it('can not change id', async () => {
        await patch.patchCantChangeId(m.post, m.patch, m.get.handle, {})
      })

      it('can not remove optional field', async () => {
        await patch.patchCanNotRemoveOptionalParameters(m.post, m.patch, m.get.handle, {})
      })
    })

    describe('put', () => {
      it('can put item and verify that only that one record changed', async () => {
        await put.canPut(m.post, m.put, m.get.handle, {})
      })

      it('can not put non existing record', async () => {
        await put.cantPutNonExistent(m.post, m.put, m.get.handle, {})
      })

      it('can not change id', async () => {
        await put.putCantChangeId(m.post, m.put, m.get.handle, {})
      })

      it('rejects put that is missing a non optional field', async () => {
        await put.putRejectsPartialModification(m.post, m.put, m.get.handle, {})
      })

      it('can remove optional field', async () => {
        await put.putCanRemoveOptionalParameters(m.post, m.put, m.get.handle, {})
      })
    })

    describe('delete', () => {
      it('can delete one of many', async () => {
        await uaDel.canDeleteOneOfMany(m.post, m.del, m.get.handle)
      })
      it('can delete some one of many', async () => {
        await uaDel.canDeleteSomeOfMany(m.post, m.del, m.get.handle)
      })

      it('can delete all of many', async () => {
        await uaDel.canDeleteAll(m.post, m.del, m.get.handle)
      })
    })
  })

  describe('with basic authentication', () => {
    const auth: AuthInput = { sub: 'user1', permissions: ['admin'] }
    const unAuthorized:AuthInput = { sub: 'user2', permissions: ['editor'] }
    beforeAll(async () => {
      await generateContract(schemaFilePath, 'test-elastic-auth', (input) => {
        input.preferredImplementation = {
          type: 'elasticsearch',
          index: indexName
        }
        input.authentication = ['admin']
        return input
      })
      // @ts-ignore
      const inputs = await import('../temp/test-elastic-auth-server')
      contract = registerRestMethods(addValidationToContract(inputs.contracts))
      m = getMethods(contract)
    })

    describe('basic workflow test with authorized user', () => {
      describe('get empty', () => {
        it('will return 404 when the element is requested by id', async () => {
          await get.expectNotFound(m.get.handle, auth)
        })

        it('will get empty sets when there are no params or multiple ids requested', async () => {
          await get.expectEmptyForNonMatchingInput(m.get.handle, auth)
          await get.expectEmptyWhenNoRecordsPresent(m.get.handle, auth)
        })

        it('will get empty sets when searching for text', async () => {
          await get.expectEmptyWithTextSearch(m.get.handle, auth)
        })
      })

      describe('post', () => {
        it('can post items and get all with empty arguments', async () => {
          await post.postAndGetRecordsByEmptyGet(m.post, m.get.handle, auth)
        })

        it('can get all posted items by id, one by one', async () => {
          await post.postAndGetRecordsByIdParam(m.post, m.get.handle, auth)
        })

        it('can get all posted items by id array', async () => {
          await post.postAndGetRecordsByIdArray(m.post, m.get.handle, auth)
        })

        it('can get some of the posted items by id array', async () => {
          await post.postAndGetSomeRecordsByIdArray(m.post, m.get.handle, auth)
        })

        it('Text search for the first generated, and it should be the first result returned', async () => {
        // So this should look for a string field that is not the id
        })

        it('will return 404 when the element is requested by id', async () => {
          await post.postRecords(m.post, auth)
          await get.expectNotFound(m.get.handle, auth)
        })

        it('will get empty sets when there are no params or multiple ids requested', async () => {
          await post.postRecords(m.post, auth)
          await get.expectEmptyForNonMatchingInput(m.get.handle, auth)
        })

        it('Gets available records, ignores non existent ones when an array of ids is supplied', async () => {
          await post.postAndGetAvailableIdsIgnoringWrong(m.post, m.get.handle, auth)
        })
        it('can perform text search', async () => {
          await post.postAndGetByTextSearch(m.post, m.get.handle, auth)
        })

        it('rejects re-post', async () => {
          await post.postAndRejectRePost(m.post, m.get.handle, auth)
        })

        it('rejects post with same id', async () => {
          await post.postAndRejectPostWithSameId(m.post, m.get.handle, auth)
        })
      })

      describe('patch', () => {
        it('can patch item and verify that only that one record changed', async () => {
          await patch.canPatch(m.post, m.patch, m.get.handle, auth)
        })

        it('can not patch non existing record', async () => {
          await patch.cantPatchNonExistent(m.post, m.patch, m.get.handle, auth)
        })

        it('can not change id', async () => {
          await patch.patchCantChangeId(m.post, m.patch, m.get.handle, auth)
        })

        it('can not remove optional field', async () => {
          await patch.patchCanNotRemoveOptionalParameters(m.post, m.patch, m.get.handle, auth)
        })
      })

      describe('put', () => {
        it('can put item and verify that only that one record changed', async () => {
          await put.canPut(m.post, m.put, m.get.handle, auth)
        })

        it('can not put non existing record', async () => {
          await put.cantPutNonExistent(m.post, m.put, m.get.handle, auth)
        })

        it('can not change id', async () => {
          await put.putCantChangeId(m.post, m.put, m.get.handle, auth)
        })

        it('rejects put that is missing a non optional field', async () => {
          await put.putRejectsPartialModification(m.post, m.put, m.get.handle, auth)
        })

        it('can remove optional field', async () => {
          await put.putCanRemoveOptionalParameters(m.post, m.put, m.get.handle, auth)
        })
      })

      describe('delete', () => {
        it('can delete one of many', async () => {
          await uaDel.canDeleteOneOfMany(m.post, m.del, m.get.handle, auth)
        })
        it('can delete some one of many', async () => {
          await uaDel.canDeleteSomeOfMany(m.post, m.del, m.get.handle, auth)
        })

        it('can delete all of many', async () => {
          await uaDel.canDeleteAll(m.post, m.del, m.get.handle, auth)
        })
      })
    })

    describe('Auth reject tests', () => {
      describe('get empty', () => {
        it('Unauthenticated user can\'t access the get endpoint, error 401', async () => {
          await authGet.expect401ForUnauthenticatedUser(m.get.handle)
        })

        it('Unauthorized user can\'t access the get endpoint, error 403', async () => {
          await authGet.expect403ForUnauthorizedUser(m.get.handle, unAuthorized)
        })
      })

      describe('post', () => {
        it('Unauthenticated user can\'t access the post endpoint, error 401', async () => {
          let err:any
          try { await post.postRecords(m.post, {}) } catch (e) {
            err = e
          }
          expect(err).toHaveProperty('code', 401)
          expect(err.response).toEqual({
            code: 401,
            data: { id: undefined },
            errorType: 'unauthorized',
            errors: ['Only logged in users can do this']
          })
          await get.expectEmptyWhenNoRecordsPresent(m.get.handle, auth)
        })

        it('Unauthorized user can\'t access the post endpoint, error 403', async () => {
          let err:any
          try { await post.postRecords(m.post, unAuthorized) } catch (e) {
            err = e
          }
          expect(err).toHaveProperty('code', 403)
          expect(err.response).toEqual({
            code: 403,
            data: { id: undefined },
            errorType: 'unauthorized',
            errors: ['You don\'t have permission to do this']
          })
          await get.expectEmptyWhenNoRecordsPresent(m.get.handle, auth)
        })

        it('posted records cannot be read by unauthenticated user', async () => {
          await post.postRecords(m.post, auth)
          await authGet.expect401ForUnauthenticatedUser(m.get.handle)
          await authGet.expect403ForUnauthorizedUser(m.get.handle, unAuthorized)
        })
      })

      describe('patch', () => {
        it('Authenticated but not authorized user gets 403', async () => {
          await authPatch.cantPatch(m.post, m.patch, m.get.handle, auth, unAuthorized)
        })
      })

      describe('put', () => {
        it('Authenticated but not authorized user gets 403', async () => {
          await authPut.cantPut(m.post, m.put, m.get.handle, auth, unAuthorized)
        })
      })

      describe('delete', () => {
        it('can delete one of many', async () => {
          await authDel.cantDeleteOneOfMany(m.post, m.del, m.get.handle, auth, unAuthorized)
        })
      })
    })
  })

  describe.only('with user authentication', () => {
    const auth: AuthInput = { sub: 'user1', permissions: ['editor'] }
    // const unAuthorized:AuthInput = { sub: 'user2', permissions: ['editor'] }
    beforeAll(async () => {
      await generateContract(schemaFilePath, 'test-elastic-user-auth', (input) => {
        input.preferredImplementation = {
          type: 'elasticsearch',
          index: indexName
        }
        input.authentication = ['admin', { userId: 'ownerId' }]
        return input
      })
      // @ts-ignore
      const inputs = await import('../temp/test-elastic-user-auth-server')
      contract = registerRestMethods(addValidationToContract(inputs.contracts))
      m = getMethods(contract)
    })

    describe('basic workflow test with authorized user', () => {
      describe('get empty', () => {
        it('will return 404 when the element is requested by id', async () => {
          await get.expectNotFound(m.get.handle, auth)
        })

        it('will get empty sets when there are no params or multiple ids requested', async () => {
          await get.expectEmptyForNonMatchingInput(m.get.handle, auth)
          await get.expectEmptyWhenNoRecordsPresent(m.get.handle, auth)
        })

        it('will get empty sets when searching for text', async () => {
          await get.expectEmptyWithTextSearch(m.get.handle, auth)
        })
      })

      describe('post', () => {
        it.only('can post items and get all with empty arguments', async () => {
          await post.postAndGetRecordsByEmptyGet(m.post, m.get.handle, auth)
        })

        it('can get all posted items by id, one by one', async () => {
          await post.postAndGetRecordsByIdParam(m.post, m.get.handle, auth)
        })

        it('can get all posted items by id array', async () => {
          await post.postAndGetRecordsByIdArray(m.post, m.get.handle, auth)
        })

        it('can get some of the posted items by id array', async () => {
          await post.postAndGetSomeRecordsByIdArray(m.post, m.get.handle, auth)
        })

        it('Text search for the first generated, and it should be the first result returned', async () => {
        // So this should look for a string field that is not the id
        })

        it('will return 404 when the element is requested by id', async () => {
          await post.postRecords(m.post, auth)
          await get.expectNotFound(m.get.handle, auth)
        })

        it('will get empty sets when there are no params or multiple ids requested', async () => {
          await post.postRecords(m.post, auth)
          await get.expectEmptyForNonMatchingInput(m.get.handle, auth)
        })

        it('Gets available records, ignores non existent ones when an array of ids is supplied', async () => {
          await post.postAndGetAvailableIdsIgnoringWrong(m.post, m.get.handle, auth)
        })
        it('can perform text search', async () => {
          await post.postAndGetByTextSearch(m.post, m.get.handle, auth)
        })

        it('rejects re-post', async () => {
          await post.postAndRejectRePost(m.post, m.get.handle, auth)
        })

        it('rejects post with same id', async () => {
          await post.postAndRejectPostWithSameId(m.post, m.get.handle, auth)
        })
      })

      describe('patch', () => {
        it('can patch item and verify that only that one record changed', async () => {
          await patch.canPatch(m.post, m.patch, m.get.handle, auth)
        })

        it('can not patch non existing record', async () => {
          await patch.cantPatchNonExistent(m.post, m.patch, m.get.handle, auth)
        })

        it('can not change id', async () => {
          await patch.patchCantChangeId(m.post, m.patch, m.get.handle, auth)
        })

        it('can not remove optional field', async () => {
          await patch.patchCanNotRemoveOptionalParameters(m.post, m.patch, m.get.handle, auth)
        })
      })

      describe('put', () => {
        it('can put item and verify that only that one record changed', async () => {
          await put.canPut(m.post, m.put, m.get.handle, auth)
        })

        it('can not put non existing record', async () => {
          await put.cantPutNonExistent(m.post, m.put, m.get.handle, auth)
        })

        it('can not change id', async () => {
          await put.putCantChangeId(m.post, m.put, m.get.handle, auth)
        })

        it('rejects put that is missing a non optional field', async () => {
          await put.putRejectsPartialModification(m.post, m.put, m.get.handle, auth)
        })

        it('can remove optional field', async () => {
          await put.putCanRemoveOptionalParameters(m.post, m.put, m.get.handle, auth)
        })
      })

      describe('delete', () => {
        it('can delete one of many', async () => {
          await uaDel.canDeleteOneOfMany(m.post, m.del, m.get.handle, auth)
        })
        it('can delete some one of many', async () => {
          await uaDel.canDeleteSomeOfMany(m.post, m.del, m.get.handle, auth)
        })

        it('can delete all of many', async () => {
          await uaDel.canDeleteAll(m.post, m.del, m.get.handle, auth)
        })
      })
    })
  })
})
