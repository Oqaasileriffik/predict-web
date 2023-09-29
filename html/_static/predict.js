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
	let pos = {};
	let autos = [];
	let step = 0;
	let steps_txt = [];
	let steps_ids = [];

	let sel_sliding = null;
	let sel_auto = null;

	if (!Array.prototype.unique) {
		Array.prototype.unique = function() {
			let unique = [];
			for (let i=0; i<this.length; ++i) {
				if (unique.indexOf(this[i]) == -1) {
					unique.push(this[i]);
				}
			}
			return unique;
		};
	}

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
		//stmt.free();

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

		autos = [];
		res = execute("SELECT u_id, substr(u_text, 2, length(u_text)-2) as u_text, cnt FROM units WHERE u_text REGEXP '^\"[A-ZÆØÅa-zæøå]' ORDER BY cnt DESC LIMIT 6");
		for (let row of res) {
			autos.push(row);
		}
		render_autos();

		$('.keyboard button').prop('disabled', false).click(keyboard_click);
		$('#compose').change(compose_change);
	}

	function sort_autos(a, b) {
		return b['cnt'] - a['cnt'];
	}

	function auto_click() {
		let e = $(this);
		steps_txt.push(e.text());
		steps_ids.push(parseInt(e.attr('data-which')));
		++step;
		$('#compose').val(steps_txt.join('+') + '+…').change();
	}

	function render_autos() {
		autos = autos.unique().sort(sort_autos);
		let html = '';
		for (let row of autos) {
			let w = row['u_text'];
			html += '<button class="btn btn-sm btn-outline-primary mx-1 btnAuto" data-which="'+row['u_id']+'">'+escHTML(w)+'</button>';
		}
		$('#auto').html(html);
		$('#auto button').off().click(auto_click);
	}

	function keyboard_click() {
		let e = $(this);
		if (e.attr('data-which')) {
			let w = e.attr('data-which');
			if (/^k-/.test(w)) {
				$('.keyboard').hide();
				$('#'+w).show();
			}
			else if (w === 'bksp') {
				let v = $('#compose').val().replace('…', '');
				$('#compose').val(v.substring(0, v.length-1) + '…').change();
			}
			else if (/^\d+$/.test(w)) {
				w = parseInt(w);
			}
			else {
				$('#compose').val($('#compose').val().replace('…', '') + w + '…').change();
			}
		}
		else {
			$('#compose').val($('#compose').val().replace('…', '') + e.text() + '…').change();
		}
	}

	function cb_completions(rv) {
		let invalid = true;
		if (rv.hasOwnProperty('cs')) {
			invalid = false;
			while (rv.cs.length > 10) {
				let cs = rv.cs.splice(0, 10);
				let res = execute("SELECT u_id, u_text, cnt FROM units WHERE u_text IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ORDER BY cnt DESC", cs);
				for (let row of res) {
					;
				}
			}
		}
		if (invalid) {
			$('#compose').addClass('is-invalid');
		}
		else {
			$('#compose').removeClass('is-invalid');
		}
	}

	function compose_change() {
		let e = $(this);
		let v = e.val().replace('…', '').trim().replace(/[+]$/, '');
		if (v.indexOf('+') === -1) {
			autos = [];
			let res = execute("SELECT u_id, substr(u_text, 2, length(u_text)-2) as u_text, cnt FROM units WHERE u_text LIKE ? ORDER BY cnt DESC LIMIT 6", ['"'+v+'%']);
			for (let row of res) {
				autos.push(row);
			}
			render_autos();
		}
		if (v) {
			v = v.replace(/[+]([nvx][nvx])/g, '+Der/$1');
			$.ajax({
				url: './callback.php',
				data: {a: 'cs', ana: v},
				dataType: 'json',
				}).done(cb_completions);
		}
	}

	function contentLoaded() {
		$('.keyboard').hide();
		$('#k-unshift').show();
		$('.keyboard button').prop('disabled', true);
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
