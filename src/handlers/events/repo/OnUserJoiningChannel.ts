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
import { UserJoiningChannelListener, UserJoiningChannelListenerInvocation } from "../../../common/listener/UserJoiningChannelListener";
import * as schema from "../../../typings/types";

/**
 * A user joined a channel
 */
@EventHandler("On user joining channel", subscription("OnUserJoiningChannel"))
export class OnUserJoiningChannel implements HandleEvent<schema.OnUserJoiningChannel.Subscription> {

    @Secret(Secrets.OrgToken)
    private readonly githubToken: string;

    constructor(private readonly listeners: UserJoiningChannelListener[]) {
    }

    public async handle(event: EventFired<schema.OnUserJoiningChannel.Subscription>,
                        context: HandlerContext,
                        params: this): Promise<HandlerResult> {
        const joinEvent = event.data.UserJoinedChannel[0];
        const repos = joinEvent.channel.repos.map(
            repo => new GitHubRepoRef(repo.owner, repo.name));
        const credentials = {token: params.githubToken};
        const addressChannels = (msg, opts) => context.messageClient.addressChannels(msg, joinEvent.channel.name, opts);
        const invocation: UserJoiningChannelListenerInvocation = {
            addressChannels,
            context,
            credentials,
            joinEvent,
            repos,
        };

        await Promise.all(params.listeners
            .map(l => l(invocation)),
        );
        return Success;
    }
}
