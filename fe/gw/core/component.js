/**
 * @extends GW.Object
 *
 * Generic UI component that is:
 *
 * - __renderable__ - can be rendered into DOM,
 * - __queriable__ - can be queried using component query,
 * - __composable__ - can be composed of other components.
 *
 * ### Component rendering
 *
 * When defining a component you have to decide how it will be rendered.
 *
 * All rendering happens in the renderComponent function. Default implementation
 * is:
 *
 *     this.el = document.createElement('div');
 *
 * You can do as you wish in renderComponent as long as:
 *
 * - rendered component is represented by single DOM element
 * - this element is returned by {@link #el} property
 *
 * ### Examples
 *
 * __Simple button__
 *
 *     @example
 *     GW.define('MyButton', 'GW.Component', {
 *       text: 'Label',
 *
 *       renderComponent: function() {
 *         this.el = document.createElement('button');
 *         this.el.textContent = this.text;
 *         this.monDom(this.el, 'click', this.fire.bind(this, 'click'));
 *       }
 *     });
 *
 *     var btn = new MyButton({
 *       renderTo: document.body,
 *       text: 'Click me',
 *       'on:click': function(btn) {
 *         print('Clicked');
 *       }
 *     });
 *
 * __Card switcher__
 *
 *     @example
 *     GW.define('TabPanel', 'GW.Component', {
 *       defaultSlot: 'cards',
 *       html: '<div class=buttons slot=buttons></div>' +
 *       	'<div class=cards slot=cards></div>',
 *
 *       'after:renderComponent': function() {
 *         // create buttons for tab switching
 *         this.children = this.children.concat(this.children.map(function(i) {
 *           i.slot = 'cards';
 *
 *           return GW.create({
 *             slot: 'buttons',
 *             xtype: 'GW.Button',
 *             text: i.title,
 *             'on:click': function() {
 *               this.selectTab(i.name);
 *             }.bind(this)
 *           });
 *         }, this));
 *
 *         this.selectTab(this.defaultTab);
 *       },
 *
 *       selectTab: function(name) {
 *         this.children.filter(function(i) {
 *           return i.slot != 'buttons';
 *         }).forEach(function(i) {
 *           i.setVisible(i.name == name);
 *         });
 *       }
 *     });
 *
 *     var p = new TabPanel({
 *       defaultTab: 'b',
 *       renderTo: 'body',
 *       children: [{
 *         name: 'a',
 *         title: 'A',
 *         html: 'Tab A'
 *       }, {
 *         name: 'b',
 *         title: 'B',
 *         html: 'Tab B'
 *       }]
 *     });
 */
GW.define('GW.Component', 'GW.Object', {
	/**
	 * @cfg {String/Element/null}
	 * Parent DOM element (or its CSS selector) to which this component
	 * will be appended. You can pass null to prevent component from
	 * rendering when it is instantiated.
	 */
	renderTo: null,

	/**
	 * @private
	 */
	initObject: function() {
		if (!this.guid) {
			this.guid = GW.uniqueId('gw-');
		}

		this.initComponent();
		if (!(this.el instanceof Element)) {
			this.el = document.gwCreateElement(this.el || {}, this);
		}

		this.el.dataset.gw = this.constructor.__className__;
		this.el.gwComponent = this;

		// insert into container
		let ct = this.renderTo;
		if (ct) {
			if (typeof ct == 'string') {
				ct = document.querySelector(ct);
			}

			if (!(ct instanceof Element)) {
				throw new Error('Invalid ct value passed to Component.render');
			}

			ct.appendChild(this.el);
		}
	},

	/**
	 * Initialize this component. This is called = require('{@link #initObject}
	 * before the component is rendered.
	 * @redef
	 */
	initComponent: function() {
	},

	/**
	 * This is the counterpart of {@link #initComponent}. It is used to
	 * release DOM resources of the component when it is being destroyed.
	 * @redef
	 */
	releaseComponent: function() {
	},

	destroy: function() {
		if (!this.el) {
			return;
		}

		this.releaseComponent();

		this.el.remove();
		delete this.el;

		GW.Component.parent.destroy.apply(this);
	},

	getParent: function() {
		var el = this.el ? this.el.parentNode : null;
		while (el && !el.gwComponent) {
			el = el.parentNode;
		}

		return el ? el.gwComponent : null;
	},

        // children:

	/**
	 * Get reference to any children of this container at any level.
	 *
	 * @param matchFn {Function} Matcher function.
	 * @return {GW.Component} Child reference.
	 */
	getChild: function(matchFn) {
		return this.traverseChildren(function(child) {
			return matchFn(child) ? 'return' : null;
		});
	},

	/**
	 * Get child components of this component. If `deep` is true, also return
	 * children that are contained in any subcomponents recursively.
	 *
	 * @param filterFn {Function} Callback to be called for each child.
	 * @param filterFn.child {GW.Component} Child
	 * @param filterFn.return {Boolean} Whether to include the child in the
	 * output array.
	 * @param deep {Boolean} Retrieve all children, not only direct ones.
	 * @return {GW.Component[]} Array of components.
	 */
	getChildren: function(filterFn, deep) {
		var children = [];

		this.traverseChildren(function(child) {
			var match = !filterFn || filterFn(child);
			if (match) {
				children.push(child);
			}

			return deep ? null : 'skip';
		}, this);

		return children;
	},

	/**
	 * Recursively traverse all children of this component.
	 *
	 * @param iterFn {Function} Callback to be called for each child.
	 * @param iterFn.child {GW.Component} Child
	 * @param iterFn.return {String/null} What to do at the current point in
	 * the tree: 'return' or 'skip'.
	 * @return {GW.Component/null} Component for which iterFn returned
	 * 'return' or null.
	 */
	traverseChildren: function(iterFn) {
		var child, status, top, stack = [top = {
			i: 0,
			c: this.el.children,
		}];

		while (true) {
			if (top.i >= top.c.length) {
				stack.pop();

				if (stack.length == 0) {
					break;
				}

				top = stack[stack.length - 1];
				continue;
			}

			child = top.c[top.i];

			status = null;
			if (child.gwComponent) {
				status = iterFn(child.gwComponent);
				if (status == 'return') {
					return child.gwComponent;
				}
			}

			top.i++;

			if (child.children && child.children.length > 0 && status != 'skip') {
				stack.push(top = {i: 0, c: child.children});
			}
		}
	},
});
