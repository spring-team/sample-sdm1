/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { TokenCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import * as appRoot from "app-root-path";
import * as fs from "fs-extra";
import * as p from "path";
import { createStatus } from "../../../../../util/github/ghub";
import { spawnAndWatch } from "../../../../../util/misc/spawned";
import { ProjectLoader } from "../../../../repo/ProjectLoader";
import { ExecuteGoalResult } from "../../../goals/goalExecution";
import { ExecuteGoalWithLog, RunWithLogContext } from "../../../goals/support/reportGoalError";
import { ProjectIdentifier } from "../projectIdentifier";

export function executePublish(projectLoader: ProjectLoader,
                               projectIdentifier: ProjectIdentifier): ExecuteGoalWithLog {
    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;

        return projectLoader.doWithProject({ credentials, id, context, readOnly: true }, async project => {
            const npmConfig = await configure();

            // TODO CD this appRoot path is not going to work from a node_module
            const result: ExecuteGoalResult = await spawnAndWatch({
                    command: "bash",
                    args: [`${appRoot.path}/scripts/npm-publish.bash`,
                        `--registry=${npmConfig.registry}`,
                        "--access",
                        npmConfig.access ? npmConfig.access : "restricted"],
                },
                {
                    cwd: project.baseDir,
                },
                rwlc.progressLog,
                {
                    errorFinder: code => code !== 0,
                });

            if (result.code === 0) {
                const pi = await projectIdentifier(project);
                const url = `${npmConfig.registry}/${pi.name}/-/${pi.name}-${pi.version}.tgz`;
                await createStatus(
                    (credentials as TokenCredentials).token,
                    id as GitHubRepoRef,
                    {
                        context: "npm/atomist/package",
                        description: "NPM package",
                        target_url: url,
                        state: "success",
                    });
                result.targetUrl = url;
            }
            return result;
        });
    };
}

async function configure(): Promise<NpmConfiguration> {
    const npmConfig = JSON.parse(process.env.ATOMIST_NPM || "{}") as NpmConfiguration;
    const npmrc = p.join(process.env.HOME || process.env.USER_DIR, ".npmrc");
    let npm = "";
    if (fs.existsSync(npmrc))  {
        npm = fs.readFileSync(npmrc).toString();
    }

    if (!npm.includes(npmConfig.npmrc)) {
        npm = `${npm}
${npmConfig.npmrc}`;
    }

    await fs.writeFile(npmrc, npm);

    return npmConfig;
}

interface NpmConfiguration {
    npmrc: string;
    registry: string;
    access: string;
}
