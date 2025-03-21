import { DiscordBase } from './extra/DiscordBase';

export type GuildMemberData =
	| APIGuildMember
	| Omit<APIGuildMember, 'user'>
	| GatewayGuildMemberUpdateDispatchData
	| GatewayGuildMemberAddDispatchData
	| APIInteractionDataResolvedGuildMember;

import type { GuildRoleStructure, ReturnCache } from '../';
import {
	type DMChannelStructure,
	type GuildMemberStructure,
	type GuildStructure,
	type MessageStructure,
	Transformers,
	type UserStructure,
	type VoiceStateStructure,
} from '../client/transformers';
import type { UsingClient } from '../commands';
import {
	Formatter,
	type GuildMemberResolvable,
	type ImageOptions,
	type MessageCreateBodyRequest,
	type MethodContext,
	type ObjectToLower,
} from '../common';
import type {
	APIGuildMember,
	APIInteractionDataResolvedGuildMember,
	APIUser,
	GatewayGuildMemberAddDispatchData,
	GatewayGuildMemberUpdateDispatchData,
	RESTGetAPIGuildMembersQuery,
	RESTGetAPIGuildMembersSearchQuery,
	RESTPatchAPIGuildMemberJSONBody,
	RESTPutAPIGuildBanJSONBody,
	RESTPutAPIGuildMemberJSONBody,
} from '../types';
import { PermissionsBitField } from './extra/Permissions';

export interface BaseGuildMember extends DiscordBase, ObjectToLower<Omit<APIGuildMember, 'user' | 'roles'>> {}
export class BaseGuildMember extends DiscordBase {
	private _roles: string[];
	joinedTimestamp?: number;
	communicationDisabledUntilTimestamp?: number | null;
	constructor(
		client: UsingClient,
		data: GuildMemberData,
		id: string,
		/** the choosen guild id */
		readonly guildId: string,
	) {
		const { roles, ...dataN } = data;
		super(client, { ...dataN, id });
		this._roles = data.roles;
		this.patch(data);
	}

	guild(mode?: 'rest' | 'flow'): Promise<GuildStructure<'cached' | 'api'>>;
	guild(mode: 'cache'): ReturnCache<GuildStructure<'cached'> | undefined>;
	guild(mode: 'cache' | 'rest' | 'flow' = 'flow') {
		switch (mode) {
			case 'cache':
				return (
					this.client.cache.guilds?.get(this.guildId) ||
					(this.client.cache.adapter.isAsync ? (Promise.resolve() as any) : undefined)
				);
			default:
				return this.client.guilds.fetch(this.guildId, mode === 'rest');
		}
	}

	fetch(force = false): Promise<GuildMemberStructure> {
		return this.client.members.fetch(this.guildId, this.id, force);
	}

	ban(body?: RESTPutAPIGuildBanJSONBody, reason?: string) {
		return this.client.members.ban(this.guildId, this.id, body, reason);
	}

	kick(reason?: string) {
		return this.client.members.kick(this.guildId, this.id, reason);
	}

	edit(body: RESTPatchAPIGuildMemberJSONBody, reason?: string): Promise<GuildMemberStructure> {
		return this.client.members.edit(this.guildId, this.id, body, reason);
	}

	presence() {
		return this.client.members.presence(this.id);
	}

	voice(mode?: 'rest' | 'flow'): Promise<VoiceStateStructure>;
	voice(mode: 'cache'): ReturnCache<VoiceStateStructure | undefined>;
	voice(mode: 'cache' | 'rest' | 'flow' = 'flow') {
		switch (mode) {
			case 'cache':
				return (
					this.client.cache.voiceStates?.get(this.id, this.guildId) ||
					(this.client.cache.adapter.isAsync ? (Promise.resolve() as any) : undefined)
				);
			default:
				return this.client.members.voice(this.guildId, this.id, mode === 'rest');
		}
	}

	toString() {
		return Formatter.userMention(this.id);
	}

	timeout(time: null | number, reason?: string): Promise<GuildMemberStructure> {
		return this.client.members.timeout(this.guildId, this.id, time, reason);
	}

	get hasTimeout(): false | number {
		return this.client.members.hasTimeout(this);
	}

	private patch(data: GuildMemberData) {
		if ('joined_at' in data && data.joined_at) {
			this.joinedTimestamp = Date.parse(data.joined_at);
		}
		if ('communication_disabled_until' in data) {
			this.communicationDisabledUntilTimestamp = data.communication_disabled_until?.length
				? Date.parse(data.communication_disabled_until)
				: null;
		}
	}

	get roles() {
		return {
			keys: Object.freeze(this._roles.concat(this.guildId)) as string[],
			list: (force = false): Promise<GuildRoleStructure[]> =>
				this.client.roles
					.list(this.guildId, force)
					.then(roles => roles.filter(role => this.roles.keys.includes(role.id))),
			add: (id: string) => this.client.members.addRole(this.guildId, this.id, id),
			remove: (id: string) => this.client.members.removeRole(this.guildId, this.id, id),
			permissions: (force = false) =>
				this.roles.list(force).then(roles => new PermissionsBitField(roles.map(x => BigInt(x.permissions.bits)))),
			sorted: (force = false): Promise<GuildRoleStructure[]> =>
				this.roles.list(force).then(roles => roles.sort((a, b) => b.position - a.position)),
			highest: (force = false): Promise<GuildRoleStructure> => this.roles.sorted(force).then(roles => roles[0]),
		};
	}

	static methods({ client, guildId }: MethodContext<{ guildId: string }>) {
		return {
			resolve: (resolve: GuildMemberResolvable): Promise<GuildMemberStructure | undefined> =>
				client.members.resolve(guildId, resolve),
			search: (query?: RESTGetAPIGuildMembersSearchQuery): Promise<GuildMemberStructure[]> =>
				client.members.search(guildId, query),
			unban: (id: string, reason?: string) => client.members.unban(guildId, id, reason),
			ban: (id: string, body?: RESTPutAPIGuildBanJSONBody, reason?: string) =>
				client.members.ban(guildId, id, body, reason),
			kick: (id: string, reason?: string) => client.members.kick(guildId, id, reason),
			edit: (id: string, body: RESTPatchAPIGuildMemberJSONBody, reason?: string): Promise<GuildMemberStructure> =>
				client.members.edit(guildId, id, body, reason),
			add: (id: string, body: RESTPutAPIGuildMemberJSONBody): Promise<GuildMemberStructure | undefined> =>
				client.members.add(guildId, id, body),
			addRole: (memberId: string, id: string) => client.members.addRole(guildId, memberId, id),
			removeRole: (memberId: string, id: string) => client.members.removeRole(guildId, memberId, id),
			fetch: (memberId: string, force = false): Promise<GuildMemberStructure> =>
				client.members.fetch(guildId, memberId, force),
			list: (query?: RESTGetAPIGuildMembersQuery, force = false): Promise<GuildMemberStructure[]> =>
				client.members.list(guildId, query, force),
		};
	}
}

export interface GuildMember extends ObjectToLower<Omit<APIGuildMember, 'user' | 'roles'>> {}
/**
 * Represents a guild member
 * @link https://discord.com/developers/docs/resources/guild#guild-member-object
 */
export class GuildMember extends BaseGuildMember {
	user: UserStructure;
	private __me?: GuildMember;
	constructor(
		client: UsingClient,
		data: GuildMemberData,
		user: APIUser,
		/** the choosen guild id */
		readonly guildId: string,
	) {
		super(client, data, user.id, guildId);
		this.user = Transformers.User(client, user);
	}

	get tag() {
		return this.user.tag;
	}

	get bot() {
		return this.user.bot;
	}

	get name() {
		return this.user.name;
	}

	get username() {
		return this.user.username;
	}

	get globalName() {
		return this.user.globalName;
	}

	/** gets the nickname or the username */
	get displayName() {
		return this.nick ?? this.globalName ?? this.username;
	}

	dm(force = false): Promise<DMChannelStructure> {
		return this.user.dm(force);
	}

	write(body: MessageCreateBodyRequest): Promise<MessageStructure> {
		return this.user.write(body);
	}

	defaultAvatarURL() {
		return this.user.defaultAvatarURL();
	}

	avatarURL(options: ImageOptions & { exclude: true }): string | null;
	avatarURL(options?: ImageOptions & { exclude?: false }): string;
	avatarURL(options?: ImageOptions & { exclude?: boolean }): string | null {
		if (!this.avatar) {
			return options?.exclude ? null : this.user.avatarURL(options);
		}

		return this.rest.cdn.guilds(this.guildId).users(this.id).avatars(this.avatar).get(options);
	}

	bannerURL(options: ImageOptions & { exclude: true }): string | undefined | null;
	bannerURL(options?: ImageOptions & { exclude?: false }): string | undefined;
	bannerURL(options?: ImageOptions & { exclude?: boolean }): string | undefined | null {
		if (!this.banner) {
			return options?.exclude ? null : this.user.bannerURL(options);
		}

		return this.rest.cdn.guilds(this.guildId).users(this.id).banners(this.banner).get(options);
	}

	async fetchPermissions(force = false) {
		if ('permissions' in this) return this.permissions as PermissionsBitField;
		return this.roles.permissions(force);
	}

	async manageable(force = false) {
		this.__me = await this.client.guilds.fetchSelf(this.guildId, force);
		const ownerId = (await this.client.guilds.fetch(this.guildId, force)).ownerId;
		if (this.user.id === ownerId) return false;
		if (this.user.id === this.client.botId) return false;
		if (this.client.botId === ownerId) return true;
		return (await this.__me!.roles.highest()).position > (await this.roles.highest(force)).position;
	}

	async bannable(force = false) {
		return (await this.manageable(force)) && (await this.__me!.fetchPermissions(force)).has(['BanMembers']);
	}

	async kickable(force = false) {
		return (await this.manageable(force)) && (await this.__me!.fetchPermissions(force)).has(['KickMembers']);
	}

	async moderatable(force = false) {
		return (
			!(await this.roles.permissions(force)).has(['Administrator']) &&
			(await this.manageable(force)) &&
			(await this.__me!.fetchPermissions(force)).has(['KickMembers'])
		);
	}
}

export interface UnavailableMember {
	pending: true;
}

export class UnavailableMember extends BaseGuildMember {}

export interface InteractionGuildMember
	extends ObjectToLower<Omit<APIInteractionDataResolvedGuildMember, 'roles' | 'deaf' | 'mute' | 'permissions'>> {}
/**
 * Represents a guild member
 * @link https://discord.com/developers/docs/resources/guild#guild-member-object
 */
export class InteractionGuildMember extends GuildMember {
	permissions: PermissionsBitField;
	constructor(
		client: UsingClient,
		data: APIInteractionDataResolvedGuildMember,
		user: APIUser,
		/** the choosen guild id */
		guildId: string,
	) {
		super(client, data, user, guildId);
		this.permissions = new PermissionsBitField(Number(data.permissions));
	}
}
