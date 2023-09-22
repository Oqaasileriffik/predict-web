/*!
 * Copyright 2023 Oqaasileriffik <oqaasileriffik@oqaasileriffik.gl> at https://oqaasileriffik.gl/
 *
 * This project is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This project is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this project.  If not, see <http://www.gnu.org/licenses/>.
 */

(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		define([], factory);
	}
	else if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	}
	else {
		root.predict = factory();
	}
}(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	let db = null;
	let _cache_p = {};
	let keyboard = null;
	let pos = {};

	let sel_sliding = null;
	let sel_auto = null;
	let sel_units = null;

	function escHTML(t) {
		let nt = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
		return nt;
	}

	function prepare(sql) {
		if (!_cache_p.hasOwnProperty(sql)) {
			_cache_p[sql] = db.prepare(sql);
		}
		return _cache_p[sql];
	}

	function execute(sql, params) {
		let rv = [];

		let stmt = sql;
		if (typeof sql === 'string') {
			stmt = prepare(sql);
		}
		stmt.reset();
		if (typeof(params) !== 'undefined') {
			stmt.bind(params);
		}
		while (stmt.step()) {
			rv.push(stmt.getAsObject());
		}
		stmt.free();

		return rv;
	}

	function sqlite_regexp(pat, subj) {
		//console.log([pat, subj]);
		return (new RegExp(pat)).test(subj);
	}

	async function populate() {
		let sqlPromise = initSqlJs({
			locateFile: filename => `https://cdn.jsdelivr.net/npm/sql.js@1.12/dist/${filename}`
		});
		let dataPromise = fetch('../predict.sqlite').then(res => res.arrayBuffer());
		const [SQL, data] = await Promise.all([sqlPromise, dataPromise])

		db = new SQL.Database(new Uint8Array(data));
		db.exec("PRAGMA case_sensitive_like = ON");
		db.create_function('regexp', sqlite_regexp);

		let res = execute("SELECT u_id, u_text FROM units WHERE (u_text LIKE '%+%' OR u_text REGEXP '^(N|V|Pali|Conj|Adv|Interj|Pron|Prop|Num|Symbol)([+]|$)') AND u_text NOT LIKE '%+vv' AND u_text NOT LIKE '%+nv' AND u_text NOT LIKE '%+vn' AND u_text NOT LIKE '%+nn' AND u_text NOT LIKE '%\"%' ORDER BY cnt DESC LIMIT 100");
		for (let row of res) {
			pos[row['u_id']] = row['u_text'];
		}
		console.log(pos);

		sel_sliding = prepare("SELECT u1, u2, u3, u4, u5, u6, cnt FROM sliding WHERE u1 = ? AND u2 = ? AND u3 = ? AND u4 = ? AND u5 = ? ORDER BY cnt DESC LIMIT 4");
		sel_auto = prepare("SELECT u6 FROM sliding WHERE u1 = ? AND u2 = ? AND u3 = ? AND u4 = ? AND u5 = ? AND u6 IN (" + Object.keys(pos).join(', ') + ") ORDER BY cnt DESC LIMIT 1");
		sel_units = prepare("SELECT u_id FROM units WHERE u_text LIKE ? ORDER BY cnt DESC LIMIT 100");

		let html = '';
		res = execute("SELECT u_id, u_text FROM units WHERE u_text REGEXP '^\"[A-ZÆØÅa-zæøå]' ORDER BY cnt DESC LIMIT 4");
		for (let row of res) {
			let w = row['u_text'];
			w = w.substring(1, w.length - 1);
			html += '<button class="btn btn-sm btn-outline-primary mx-1 btnAuto" data-which="'+row['u_id']+'">'+escHTML(w)+'</button>';
		}
		$('#auto').html(html);

		let dmks = [];
		res = execute("SELECT u_id, u_text FROM units WHERE (u_text LIKE '%+vv' OR u_text LIKE '%+nv' OR u_text LIKE '%+vn' OR u_text LIKE '%+nn') ORDER BY cnt DESC LIMIT 60");
		for (let row in res) {
			dmks.push([row['u_text'], row['u_id']]);
		}

		keyboard.setOptions({
			layout: {
				default: [
					'\u00BD 1 2 3 4 5 6 7 8 9 0 + \u00B4 {bksp}',
					'{tab} q w e r t y u i o p \u00E5 ¨',
					'{lock} a s d f g h j k l \u00E6 \u00F8 \' {enter}',
					'{shift} < z x c v b n m , . - {shift}',
					'DM1 @ {space}',
				],
				shift: [
					'\u00A7 ! " # $ % & / ( ) = ? ` {bksp}',
					'{tab} Q W E R T Y U I O P \u00C5 ^',
					'{lock} A S D F G H J K L \u00C6 \u00D8 * {enter}',
					'{shift} > Z X C V B N M ; : _ {shift}',
					'DM2 @ {space}',
				],
			},
		});
	}

	function onChange(input) {
		$('.input').val(input);
		console.log('Input changed', input);
	}

	function onKeyPress(button) {
		console.log('Button pressed', button);

		if (button === '{shift}' || button === '{lock}') {
			handleShift();
		}
	}

	function handleShift() {
		let currentLayout = keyboard.options.layoutName;
		let shiftToggle = currentLayout === 'default' ? 'shift' : 'default';

		keyboard.setOptions({
			layoutName: shiftToggle,
		});
	}

	function contentLoaded() {
		keyboard = new window.SimpleKeyboard.default({
			onChange: input => onChange(input),
			onKeyPress: button => onKeyPress(button),
			layout: {
				default: [
					'…loading…',
				],
			},
		});

		$('.input').on('input', event => {
			keyboard.setInput(event.target.value);
		});

		console.log(keyboard);
		populate();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', contentLoaded);
	}
	else {
		contentLoaded();
	}

	// Export useful functions
	return {
		// None atm...
		};
}));
