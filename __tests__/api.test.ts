import axios from 'axios'
import type * as Api from '../src/api'

// @actions/core pulls in node: builtins that this jest version cannot resolve.
jest.doMock('@actions/core', () => ({debug: jest.fn(), error: jest.fn()}))
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {Project} = require('../src/api') as typeof Api

const mockedGet = jest.spyOn(axios, 'get')

test('scoped ATATT token falls back to the gateway when the tenant URL cannot see the project', async () => {
  mockedGet.mockImplementation(async (url: string): Promise<unknown> => {
    if (url === 'https://acme.atlassian.net/_edge/tenant_info')
      return {data: {cloudId: 'cloud-123'}}
    if (url.startsWith('https://acme.atlassian.net/rest/'))
      throw {
        isAxiosError: true,
        response: {
          status: 404,
          data: {errorMessages: ["No project could be found with key 'PROJ'."]}
        }
      }
    if (
      url.startsWith(
        'https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/project/PROJ'
      )
    )
      return {data: {id: '1', key: 'PROJ', versions: [{name: 'v1'}]}}
    throw new Error(`unexpected ${url}`)
  })

  const project = await Project.create('a@b.c', 'ATATTscoped', 'PROJ', 'acme')

  expect(project.baseUrl).toBe('https://api.atlassian.com/ex/jira/cloud-123')
  expect(project.getVersion('v1')).toEqual({name: 'v1'})
})
