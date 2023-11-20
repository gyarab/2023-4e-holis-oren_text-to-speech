Object.assign(Element.prototype, {
	gwAnimate: function(config) {
		return new Promise((resolve, reject) => {
			var duration = config.duration || 0.4,
				change = {},
				names = [];

			for (let [k, v] of Object.entries(config)) {
				if (k != 'duration' && k != 'timing') {
					change[k] = v;
					names.push(k);
				}
			}
	
			let finish = () => {
				this.style.transition = '';
				this.removeEventListener('transitionend', finish);
				resolve();
			};

			this.addEventListener('transitionend', finish);

			Object.assign(this.style, {
				'transition-property': names.join(', '),
				'transition-duration': duration + 's',
				'transition-timing-function': config.timing || 'ease'
			});

			this.offsetHeight;
		
			Object.assign(this.style, change);
		});
	},
});
