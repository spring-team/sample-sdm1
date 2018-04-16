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

import { EventFired, EventHandler, HandleEvent, HandlerContext, HandlerResult, Secret, Secrets, Success } from "@atomist/automation-client";
import { subscription } from "@atomist/automation-client/graph/graphQL";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { BuildListener, BuildListenerInvocation } from "../../../../common/listener/BuildListener";
import { AddressChannels, addressChannelsFor } from "../../../../common/slack/addressChannels";
import { OnBuildComplete } from "../../../../typings/types";

/**
 * Invoke listeners on complete build. Not a part of our delivery flow:
 * just observational.
 */
@EventHandler("Invoke listeners on build complete", subscription("OnBuildComplete"))
export class InvokeListenersOnBuildComplete implements HandleEvent<OnBuildComplete.Subscription> {

    @Secret(Secrets.OrgToken)
    private readonly githubToken: string;

    constructor(private readonly listeners: BuildListener[]) {
    }

    public async handle(event: EventFired<OnBuildComplete.Subscription>,
                        context: HandlerContext,
                        params: this): Promise<HandlerResult> {
        const build = event.data.Build[0];
        const repo = build.commit.repo;
        const id = new GitHubRepoRef(repo.owner, repo.name);
        const credentials = {token: params.githubToken};

        const addressChannels: AddressChannels = addressChannelsFor(repo, context);
        const bli: BuildListenerInvocation = {
            context,
            id,
            credentials,
            addressChannels,
            build,
        };
        await Promise.all(params.listeners
            .map(l => l(bli)),
        );
        return Success;
    }
}
