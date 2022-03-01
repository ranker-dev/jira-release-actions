import * as core from '@actions/core'
import {
  EMAIL,
  API_TOKEN,
  SUBDOMAIN,
  RELEASE_NAME,
  PROJECT,
  CREATE,
  TICKETS,
  DRY_RUN,
  RELEASE
} from './env'
import {Project} from './api'
import {Version} from './models'

async function run(): Promise<void> {
  try {
    if (DRY_RUN === 'ci') {
      core.info(`email ${EMAIL}`)
      core.info(`project ${PROJECT}`)
      core.info(`subdomain ${SUBDOMAIN}`)
      core.info(`release ${RELEASE_NAME}`)
      core.info(`create ${CREATE}`)
      core.info(`tickets ${TICKETS}`)
      core.info(`release ${RELEASE}`)
      
      return
    }

    if (DRY_RUN === 'true') {
      core.info(`email ${EMAIL}`)
      core.info(`project ${PROJECT}`)
      core.info(`subdomain ${SUBDOMAIN}`)
      core.info(`release ${RELEASE_NAME}`)
      core.info(`create ${CREATE}`)
      core.info(`tickets ${TICKETS}`)
      core.info(`release ${RELEASE}`)

      const project = await Project.create(EMAIL, API_TOKEN, PROJECT, SUBDOMAIN)
      core.info(`Project loaded ${project.project?.id}`)
      
      const version = project.getVersion(RELEASE_NAME)

      if (version === undefined) {
        core.info(`Version ${RELEASE_NAME} not found`)
      } else {
        core.info(`Version ${RELEASE_NAME} found`)
      }
      
      return
    }

    const project = await Project.create(EMAIL, API_TOKEN, PROJECT, SUBDOMAIN)

    core.debug(`Project loaded ${project.project?.id}`)

    let version = project.getVersion(RELEASE_NAME)
    let release = RELEASE == 'true';

    if (version === undefined) {
      core.info(`Version ${RELEASE_NAME} not found`)

      if (CREATE === 'true') {
        core.info(`Version ${RELEASE_NAME} is going to be created`)

        const versionToCreate: Version = {
          name: RELEASE_NAME,
          archived: false,
          released: release,
          startDate: new Date(Date.now() - 8*60*60*1000).toISOString(),
          releaseDate: undefined,
          projectId: Number(project.project?.id)
        };
        
        if(release) {
          versionToCreate.releaseDate = new Date(Date.now() - 8*60*60*1000).toISOString();
        }
        
        version = await project.createVersion(versionToCreate)
        core.info(versionToCreate.name)
      }
    } else {
      core.info(`Version ${RELEASE_NAME} found and is going to be updated`)
      
      const versionToUpdate: Version = {
        ...version,
        self: undefined,
        userStartDate: undefined,
        userReleaseDate: undefined,
        released: release
      }
      
      if(release) {
        versionToUpdate.releaseDate = new Date(Date.now() - 8*60*60*1000).toISOString();
      }
      
      version = await project.updateVersion(versionToUpdate)
    }

    if (TICKETS !== '' && version?.id) {
      const tickets = TICKETS.split(',')
      await Promise.all(tickets.map(ticket => {
        core.info(`Going to update ticket ${ticket}`)
        // @ts-ignore
        return project.updateIssue(ticket, version.id)
      }))
    }
  } catch (_e) {
    const e: Error = _e

    core.error(`Error ${e}`);

    core.setFailed(e)
  }
}

run()
