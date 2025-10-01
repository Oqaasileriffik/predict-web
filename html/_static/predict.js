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
	let units = {};
	let pos = {};
	let keys = {};
	let dms = {};
	let autos = [];

	let steps_txt = [];
	let steps_ids = [];

	const ST_LEMMA = 1;
	const ST_DMS = 2;
	const ST_FLEX = 3;
	let in_state = null;

	let sel_sliding = null;
	let sel_sliding_cs = null;
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
		let dataPromise = fetch('predict.sqlite').then(res => res.arrayBuffer());
		const [SQL, data] = await Promise.all([sqlPromise, dataPromise])

		db = new SQL.Database(new Uint8Array(data));
		db.exec("PRAGMA case_sensitive_like = ON");
		db.create_function('regexp', sqlite_regexp);

		let res = execute("SELECT u_id, u_text FROM units WHERE (u_text LIKE '%+%' OR u_text REGEXP '^(N|V|Pali|Conj|Adv|Interj|Pron|Prop|Num|Symbol)([+]|$)') AND u_text NOT LIKE '%+vv' AND u_text NOT LIKE '%+nv' AND u_text NOT LIKE '%+vn' AND u_text NOT LIKE '%+nn' AND u_text NOT LIKE '%\"%' ORDER BY cnt DESC LIMIT 100");
		for (let row of res) {
			pos[row['u_id']] = row['u_text'];
			units[row['u_id']] = row['u_text'];
		}
		console.log(pos);

		res = execute("SELECT u_id, u_text FROM units WHERE (u_text LIKE '%+nv' OR u_text LIKE '%+nn') ORDER BY cnt DESC LIMIT 12");
		for (let row of res) {
			keys[row['u_id']] = row['u_text'];
		}
		res = execute("SELECT u_id, u_text FROM units WHERE (u_text LIKE '%+vv' OR u_text LIKE '%+vn') AND u_text != 'HTR+vv' ORDER BY cnt DESC LIMIT 12");
		for (let row of res) {
			keys[row['u_id']] = row['u_text'];
		}
		console.log(keys);

		res = execute("SELECT u_id, u_text FROM units WHERE u_text LIKE '%+nv' OR u_text LIKE '%+nn' OR u_text LIKE '%+vv' OR u_text LIKE '%+vn' OR u_text LIKE '%+xx'");
		for (let row of res) {
			dms[row['u_id']] = row['u_text'];
			dms[row['u_text']] = row['u_id'];
			units[row['u_id']] = row['u_text'];
		}

		res = execute("SELECT u_id, u_text FROM units WHERE u_text IN ('TA', 'AA', 'AASIIT', 'AASIT', 'GUUQ', 'KASIK', 'LI', 'LU', 'LUUNNIIT', 'LUSUUQ', 'MAA', 'MAANNA', 'MAANNAA', 'MI', 'MITA', 'MITAAVA', 'PALAAQ', 'QQINNAAQ', 'TTAAQ', 'UKU', 'UKUA', 'UNA')");
		for (let row of res) {
			units[row['u_id']] = row['u_text'];
		}

		sel_sliding = prepare("SELECT u1, u2, u3, u4, u5, u6, cnt FROM sliding WHERE u1 = ? AND u2 = ? AND u3 = ? AND u4 = ? AND u5 = ? ORDER BY cnt DESC LIMIT 6");
		sel_sliding_cs = "SELECT u6 as u_id, SUM(cnt) as cnt FROM sliding WHERE u1 = ? AND u2 = ? AND u3 = ? AND u4 = ? AND u5 = ? AND u6 NOT IN ("+Object.keys(keys).join(', ')+") AND u6 IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) GROUP BY u6 ORDER BY SUM(cnt) DESC";
		sel_auto = prepare("SELECT u6 FROM sliding WHERE u1 = ? AND u2 = ? AND u3 = ? AND u4 = ? AND u5 = ? AND u6 IN (" + Object.keys(pos).join(', ') + ") ORDER BY cnt DESC LIMIT 1");

		autos = [{u_id: 118, u_text: 'TA'}, {u_id: 445, u_text: 'AA'}];
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

	function nodots(t) {
		return t.replace('…', '');
	}

	function auto_click() {
		let e = $(this);
		let txt = e.attr('data-text');
		let id = parseInt(e.attr('data-id'));
		if (id === 0) {
			$('#text').val(($('#text').val() + ' ' + txt).trim());
			steps_txt = [];
			steps_ids = [];
			$('#compose').val('');
			return;
		}
		steps_txt.push(txt);
		steps_ids.push(id);
		console.log([steps_ids, steps_txt]);
		$('#compose').val(steps_txt.join('+') + '+…').change();
	}

	function render_autos() {
		autos = autos.unique().sort(sort_autos);
		let html = '';
		for (let row of autos) {
			let w = row['u_text'].replace(/[+][nvx][nvx]$/, '');
			html += '<button class="btn btn-sm btn-outline-primary mx-1 btnAuto" data-id="'+row['u_id']+'" data-text="'+escHTML(row['u_text'])+'">'+escHTML(w)+'</button>';
		}
		$('#auto').html(html);
		$('#auto button').off().click(auto_click);
	}

	function commit_word() {
		;
	}

	function keyboard_click() {
		let e = $(this);
		if (e.attr('data-which')) {
			let w = e.attr('data-which');
			if (/^k-/.test(w)) {
				$('.keyboard').hide();
				$('#'+w).show();
			}
			else if (w === 'commit' || w === 'enter') {
				if (steps_txt.length || $('#compose').val().length) {
					w = 'commit';
				}
				if (w === 'commit') {
					commit_word();
				}
				else {
					$('#text').val($('#text').val() + '\n');
				}
			}
			else if (w === 'bksp') {
				let v = nodots($('#compose').val());
				$('#compose').val(v.substring(0, v.length-1) + '…').change();
			}
			else if (/^\d+$/.test(w)) {
				w = parseInt(w);
				steps_txt.push(keys[w]);
				steps_ids.push(w);
				$('#compose').val(steps_txt.join('+') + '+…').change();
					}
			else {
				$('#compose').val(nodots($('#compose').val()) + w + '…').change();
			}
		}
		else {
			$('#compose').val(nodots($('#compose').val()) + e.text() + '…').change();
		}
	}

	function cb_completions(rv) {
		let invalid = true;
		if (rv.hasOwnProperty('cs')) {
			invalid = false;

			let dm_ids = Array.from(Object.keys(pos));
			while (rv.cs.length % 10 !== 0) {
				rv.cs.push('X');
			}
			for (let dm of rv.cs) {
				if (dms.hasOwnProperty(dm)) {
					dm_ids.push(dms[dm]);
				}
			}
			while (dm_ids.length % 10 !== 0) {
				dm_ids.push(-1);
			}

			autos = [];
			let state = Array.from(steps_ids);
			while (state.length < 5) {
				state.unshift(0);
			}
			while (state.length > 5) {
				state.shift();
			}
			console.log(state);

			for (let i=0 ; i<6 ; ++i) {
				let css = Array.from(dm_ids);
				let sql = sel_sliding_cs;
				let lstate = Array.from(state);
				for (let s=0 ; s<i ; ++s) {
					sql = sql.replace('u'+(s+1)+' = ? AND ', '');
					lstate.shift();
				}
				console.log([i, sql, lstate, css]);
				let conts = [];
				while (css.length >= 10) {
					let cs = lstate.concat(css.splice(0, 10));
					let res = execute(sql, cs);
					for (let row of res) {
						row['u_text'] = units[row['u_id']];
						conts.push(row);
					}
				}
				autos = conts.unique().sort(sort_autos).slice(0, 6);
				if (autos.length) {
					if (/[+]n/.test(autos[0].u_text) || /^(N|Prop|Pron|Num)[+]/.test(autos[0].u_text)) {
						$('.keyboard').hide();
						$('#k-dms-n').show();
					}
					else /* if (/[+]v/.test(autos[0].u_text)) */ {
						$('.keyboard').hide();
						$('#k-dms-v').show();
					}
					console.log([i, lstate, conts, autos]);
					break;
				}
			}
			render_autos();
		}
		if (rv.hasOwnProperty('gen')) {
			invalid = false;
			for (let gen of rv.gen) {
				gen = gen.split('\t')[1];
				autos.unshift({u_id: 0, u_text: gen, cnt: autos[0].cnt + 1});
			}
			autos = autos.slice(0, 6);
			render_autos();
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
		let v = nodots(e.val()).trim().replace(/[+]$/, '');
		if (steps_txt.length === 1 && /^(TA|AA)$/.test(steps_txt[0])) {
			autos = [];

			let res = execute("SELECT DISTINCT u6 as u_id, substr(u_text, 2, length(u_text)-2) as u_text FROM sliding as sl INNER JOIN units ON (u6 = u_id) WHERE u4 = 0 AND u5 = ? ORDER BY sl.cnt DESC LIMIT 6", steps_ids);
			for (let row of res) {
				autos.push(row);
			}
			render_autos();
		}
		else if (v.indexOf('+') === -1) {
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
