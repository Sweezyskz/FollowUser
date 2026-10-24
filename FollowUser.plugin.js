/**
 * @name Follow User
 * @author Sweezy
 * @source https://github.com/Sweezyskz/FollowUser
 * @updateUrl https://raw.githubusercontent.com/Sweezyskz/FollowUser/main/FollowUser.plugin.js
 * @version 1.0.0
 * @description Clic droit sur un utilisateur pour le suivre automatiquement de vocal en vocal.
 */

const { Webpack, ContextMenu, Utils, DOM } = BdApi,
	config = {};

module.exports = class FollowUser {
	constructor(meta) {
		config.info = meta;
		this.currentFollowedId = null;
	}

	start() {
		this.VoiceStateStore = Webpack.getStore("VoiceStateStore");
		this.UserStore = Webpack.getStore("UserStore");
		this.selectVoiceChannel = Webpack.getByKeys("selectVoiceChannel").selectVoiceChannel;
		DOM.addStyle(config.info.slug, `
			.fu-following { position: relative; }
			.fu-following img[class*="avatar"] { outline: 2px solid #61afef; outline-offset: 1px; border-radius: 50%; box-shadow: 0 0 6px #61afef; }
			.fu-following::after { content: "➤"; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: #61afef; font-size: 12px; pointer-events: none; }
		`);
		this.patchUserContextMenu();
		this.onChange = () => this.tick();
		this.VoiceStateStore.addChangeListener(this.onChange);
		this.timer = setInterval(() => this.updateIndicator(), 500);
	}

	stop() {
		config.userContextPatch?.();
		this.VoiceStateStore?.removeChangeListener(this.onChange);
		clearInterval(this.timer);
		this.currentFollowedId = null;
		this.updateIndicator();
		DOM.removeStyle(config.info.slug);
	}

	tick() {
		if (!this.currentFollowedId) return;
		const target = this.VoiceStateStore.getVoiceStateForUser(this.currentFollowedId);
		const me = this.VoiceStateStore.getVoiceStateForUser(this.UserStore.getCurrentUser().id);
		if (target?.channelId && target.channelId !== me?.channelId) {
			this.selectVoiceChannel(target.channelId);
		}
	}

	updateIndicator() {
		document.querySelectorAll(".fu-following").forEach(el => el.classList.remove("fu-following"));
		if (!this.currentFollowedId) return;
		document.querySelectorAll('[class*="voiceUser"]').forEach(el => {
			let fiber = BdApi.ReactUtils.getInternalInstance(el);
			for (let i = 0; fiber && i < 15; i++, fiber = fiber.return) {
				if (fiber.memoizedProps?.user?.id === this.currentFollowedId) { el.classList.add("fu-following"); return; }
			}
		});
	}

	patchUserContextMenu() {
		const ids = ["user-context", "user-profile-actions", "dm-user-context", "voice-user-context"];
		const unpatches = ids.map(id => ContextMenu.patch(id, (returnValue, props) => {
			if (!props?.user?.id) return;
			const children = Utils.findInTree(returnValue, e => Array.isArray(e) && e.some(c => c?.props?.id), { walkable: ["props", "children"] });
			if (!Array.isArray(children)) return;
			if (children.some(g => g?.props?.id === config.info.slug)) return;

			const followed = this.currentFollowedId === props.user.id;
			children.push(ContextMenu.buildItem({ type: "separator" }), ContextMenu.buildItem({
				id: config.info.slug,
				label: "Follow User",
				checked: followed,
				type: "toggle",
				action: () => {
					this.currentFollowedId = followed ? null : props.user.id;
					this.tick();
					this.updateIndicator();
				}
			}));
		}));
		config.userContextPatch = () => unpatches.forEach(u => u?.());
	}
};
