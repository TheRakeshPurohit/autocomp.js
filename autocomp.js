let nextId = 0;

export function autocomp(el, options = {}) {
	const opt = {
		onQuery: null, onNavigate: null, onSelect: null, onRender: null, debounce: 100, autoSelect: true, ...options
	};

	const id = `autocomp-${++nextId}`;
	let box, cur = opt.autoSelect ? 0 : -1, items = [], val, req, version = 0;

	// Disable browser's default autocomplete behaviour on the input.
	el.autocomplete = "off";
	[["role", "combobox"], ["aria-autocomplete", "list"], ["aria-haspopup", "listbox"], ["aria-expanded", "false"]].forEach(([name, value]) => el.setAttribute(name, value));

	// Attach all the events required for the interactions in one go.
	["input", "keydown", "blur"].forEach(k => el.addEventListener(k, handleEvent));

	function handleEvent(e) {
		if (e.type === "keydown" && !handleKeydown(e)) {
			return;
		}

		if (e.type === "blur") {
			return destroy();
		}

		const newVal = e.target.value;
		if (!newVal) {
			destroy();
			val = null;
			return;
		}

		if (newVal === val && box) {
			return;
		}
		val = newVal;
		version++;

		// Clear (debounce) any existing pending requests and queue
		// the next search request.
		clearTimeout(req);
		req = setTimeout(query, opt.debounce);
	}

	function handleKeydown(e) {
		// Escape early.
		if (e.keyCode === 27) {
			destroy();
			return;
		}

		if (!box) {
			return e.keyCode === 38 || e.keyCode === 40
		}

		switch (e.keyCode) {
			case 38: return navigate(-1, e); // Up arrow.
			case 40: return navigate(1, e); // Down arrow
			case 9: // Tab
			case 13: // Enter
				if (e.keyCode === 13 && cur >= 0 && cur < items.length) {
					e.preventDefault();
				}
				select(cur);
				destroy();
				return;
		}
	}

	async function query() {
		if (!val) {
			return;
		}

		const curVer = version;
		const results = await opt.onQuery(val);
		// Ignore responses for an older/slower query or a dismissed dropdown.
		if (curVer !== version) {
			return;
		}

		items = results;
		if (!items.length) {
			return destroy();
		}

		if (!box) {
			createBox();
		}

		renderResults();
	}

	function createBox() {
		box = document.createElement("div");
		box.id = id;
		box.setAttribute("role", "listbox");
		Object.assign(box.style, {
			width: window.getComputedStyle(el).width,
			position: "absolute",
			left: `${el.offsetLeft}px`,
			top: `${el.offsetTop + el.offsetHeight}px`
		});

		box.classList.add("autocomp");
		el.parentNode.insertBefore(box, el.nextSibling);
		[["aria-controls", id], ["aria-expanded", "true"]].forEach(([name, value]) => el.setAttribute(name, value));
	}

	function renderResults() {
		el.removeAttribute("aria-activedescendant");
		if (cur >= items.length) {
			cur = opt.autoSelect ? 0 : -1;
		}

		box.innerHTML = "";
		items.forEach((item, idx) => {
			const div = document.createElement("div");
			div.classList.add("autocomp-item");
			div.id = `${id}-${idx}`;
			[["role", "option"], ["aria-selected", idx === cur ? "true" : "false"]].forEach(([name, value]) => div.setAttribute(name, value));

			// If there's a custom renderer callback, use it, else, simply insert the value/text as-is.
			opt.onRender ? div.appendChild(opt.onRender(item)) : div.innerText = item;
			if (idx === cur) {
				div.classList.add("autocomp-sel");
			}

			div.addEventListener("mousedown", (e) => {
				e.preventDefault();
				select(idx);
				destroy();
			});
			box.appendChild(div);
		});

		if (cur >= 0 && cur < items.length) {
			el.setAttribute("aria-activedescendant", box.children[cur].id);
		}
	}

	function navigate(direction, e) {
		e.preventDefault();

		// Remove the previous item's highlight;
		const prev = box.querySelector(`:nth-child(${cur + 1})`);
		prev?.classList.remove("autocomp-sel");
		prev?.setAttribute("aria-selected", "false");

		// Increment the cursor and highlight the next item, cycled between [0, n].
		cur = cur < 0 ? (direction > 0 ? 0 : items.length - 1) : (cur + direction + items.length) % items.length;
		const next = box.querySelector(`:nth-child(${cur + 1})`);
		next.classList.add("autocomp-sel");
		next.setAttribute("aria-selected", "true");
		el.setAttribute("aria-activedescendant", next.id);
	}

	function select(idx) {
		if (!opt.onSelect || idx < 0 || idx >= items.length) {
			return;
		}

		val = opt.onSelect(items[idx], items);
		el.value = val || items[idx];
	}

	function destroy() {
		clearTimeout(req);
		version++;

		el.setAttribute("aria-expanded", "false");
		["aria-controls", "aria-activedescendant"].forEach(name => el.removeAttribute(name));
		items = [];
		cur = opt.autoSelect ? 0 : -1;
		if (box) {
			box.remove();
			box = null;
		}
	}
}

export default autocomp;
