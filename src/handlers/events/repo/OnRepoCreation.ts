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

import {
    EventFired,
    EventHandler,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    Secret,
    Secrets,
    Success,
} from "@atomist/automation-client";
import { subscription } from "@atomist/automation-client/graph/graphQL";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import {
    RepoCreationInvocation,
    RepoCreationListener,
} from "../../../common/listener/RepoCreationListener";
import { AddressNoChannels } from "../../../common/slack/addressChannels";
import * as schema from "../../../typings/types";

/**
 * A new repo has been created. We don't know if it has code.
 */
@EventHandler("On repo creation", subscription("OnRepoCreation"))
export class OnRepoCreation implements HandleEvent<schema.OnRepoCreation.Subscription> {

    @Secret(Secrets.OrgToken)
    private readonly githubToken: string;

    private readonly newRepoActions: RepoCreationListener[];

    constructor(...newRepoActions: RepoCreationListener[]) {
        this.newRepoActions = newRepoActions;
    }

    public async handle(event: EventFired<schema.OnRepoCreation.Subscription>,
                        context: HandlerContext,
                        params: this): Promise<HandlerResult> {
        const repo = event.data.Repo[0];
        const id = new GitHubRepoRef(repo.owner, repo.name);
        const invocation: RepoCreationInvocation = {
            addressChannels: AddressNoChannels,
            id,
            context,
            repo,
            credentials: {token: params.githubToken},
        };
        await Promise.all(params.newRepoActions.map(a => a(invocation)));
        return Success;
    }
}
