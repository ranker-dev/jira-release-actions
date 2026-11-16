import * as core from '@actions/core'
import axios, {AxiosError} from 'axios'
import {Version, ProjectDTO} from './models'

export class Project {
  email: string
  token: string
  name: string
  domain: string
  baseUrl: string

  project?: ProjectDTO

  constructor(email: string, token: string, name: string, domain: string) {
    this.email = email
    this.token = token
    this.name = name
    this.domain = domain
    this.baseUrl = `https://${this.domain}.atlassian.net`
  }

  async _useGateway(): Promise<void> {
    // Service-account (ATSTT) and scoped (ATATT) API tokens are refused by the
    // tenant URL and only work via the api.atlassian.com gateway.
    const tenantInfo = await axios.get(
      `https://${this.domain}.atlassian.net/_edge/tenant_info`
    )
    const cloudId = tenantInfo?.data?.cloudId
    if (!cloudId) {
      throw new Error(
        `cloudId could not be resolved from ${this.domain}.atlassian.net/_edge/tenant_info`
      )
    }
    this.baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`
  }

  getVersion(rel: string): Version | undefined {
    if (this.project === undefined) return undefined
    else {
      const result = this.project.versions?.filter(i => i.name === rel)
      if (result === undefined) return undefined
      if (result.length === 0) {
        return undefined
      } else return result[0]
    }
  }

  async createVersion(version: Version): Promise<Version> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/rest/api/3/version`,
        version,
        this._authHeaders()
      )
      return response?.data
    } catch (error: unknown) {
      return Promise.reject(toMoreDescriptiveError(error))
    }
  }

  async updateVersion(version: Version): Promise<Version> {
    try {
      core.debug(JSON.stringify(version))
      const response = await axios.put(
        `${this.baseUrl}/rest/api/3/version/${version.id}`,
        version,
        this._authHeaders()
      )
      return response?.data
    } catch (error: unknown) {
      return Promise.reject(toMoreDescriptiveError(error))
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async updateIssue(ticket: string, version: string) {
    try {
      const response = await axios.put(
        `${this.baseUrl}/rest/api/3/issue/${ticket}`,
        {
          update: {
            fixVersions: [
              {
                add: {id: version}
              }
            ]
          }
        },
        this._authHeaders()
      )
      return response?.data
    } catch (error: unknown) {
      return Promise.reject(toMoreDescriptiveError(error))
    }
  }

  static async create(
    email: string,
    token: string,
    name: string,
    domain: string
  ): Promise<Project> {
    const result = new Project(email, token, name, domain)
    if (token.startsWith('ATSTT')) await result._useGateway()
    try {
      return await result._load()
    } catch (error: unknown) {
      // ATATT tokens can be classic (tenant URL) or scoped (gateway only) and
      // the prefix does not tell them apart. The tenant URL treats a scoped
      // token as anonymous (401, or 404 for the project), so retry via the
      // gateway in that case.
      const status = isAxiosError(error) ? error.response?.status : undefined
      if (token.startsWith('ATSTT') || (status !== 401 && status !== 404)) {
        return Promise.reject(toMoreDescriptiveError(error))
      }
    }
    try {
      await result._useGateway()
      return await result._load()
    } catch (error: unknown) {
      return Promise.reject(toMoreDescriptiveError(error))
    }
  }

  async _load(): Promise<Project> {
    const response = await axios.get(
      `${this.baseUrl}/rest/api/3/project/${this.name}?properties=versions,key,id,name`,
      this._authHeaders()
    )
    this.project = response?.data
    return this
  }

  _authHeaders(): Object {
    return {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.email}:${this.token}`
        ).toString('base64')}`,
        Accept: 'application/json'
      }
    }
  }
}

const toMoreDescriptiveError = (error: unknown): Error | unknown => {
  if (
    isAxiosError(error) &&
    error.response?.status === 404 &&
    Array.isArray(error.response.data?.errorMessages)
  ) {
    return new Error(
      `${error.response.data?.errorMessages[0]} (this may be due to a missing/invalid API key)`
    )
  } else {
    core.error(`error: ${error}`)
    // @ts-ignore
    if (error.response?.data) {
      // @ts-ignore
      core.error(`data: ${JSON.stringify(error.response?.data)}`)
    }
    return error
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isAxiosError = (error: any): error is AxiosError =>
  error?.isAxiosError ?? false
