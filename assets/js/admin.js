/* =========================================================================
 * admin.js — 방문 현황 (admin.html 전용)
 *
 * 화면의 잠금은 편의일 뿐이다. 실제 권한은 firestore.rules 가 막는다.
 * 관리자가 아니면 여기서 목록을 요청해도 서버가 거절한다.
 * ========================================================================= */
(function (global) {
  'use strict';

  var Auth = global.LuneAuth;
  var $ = function (s) { return document.querySelector(s); };

  var gate = $('#adminGate');
  var gateMsg = $('#adminGateMsg');
  var body = $('#adminBody');

  function showGate(msg) {
    gate.hidden = false;
    body.hidden = true;
    gateMsg.innerHTML = msg;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return '—';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  async function load() {
    var stats = await Auth.getStats(14);
    var users = await Auth.listUsers(200);

    /* 요약 카드 */
    var todayCount = stats && stats.daily.length ? stats.daily[0].count : 0;
    var weekCount = stats
      ? stats.daily.slice(0, 7).reduce(function (s, d) { return s + d.count; }, 0)
      : 0;

    $('#statCards').innerHTML = [
      { label: '누적 방문', value: stats ? stats.total : 0 },
      { label: '오늘', value: todayCount },
      { label: '최근 7일', value: weekCount },
      { label: '로그인 사용자', value: users.length },
    ].map(function (s) {
      return '<div class="stat">' +
        '<span class="micro">' + s.label + '</span>' +
        '<b class="stat__num">' + s.value.toLocaleString('ko-KR') + '</b>' +
      '</div>';
    }).join('');

    /* 일별 막대 — 오래된 날짜가 왼쪽에 오도록 뒤집는다 */
    var daily = stats ? stats.daily.slice().reverse() : [];
    var max = Math.max.apply(null, daily.map(function (d) { return d.count; }).concat([1]));
    $('#dailyChart').innerHTML = daily.map(function (d) {
      var h = Math.round((d.count / max) * 100);
      return '<div class="daily__col" title="' + d.date + ' · ' + d.count + '회">' +
        '<span class="daily__bar" style="height:' + Math.max(h, 2) + '%"></span>' +
        '<span class="daily__val">' + d.count + '</span>' +
        '<span class="daily__day">' + d.date.slice(5) + '</span>' +
      '</div>';
    }).join('');

    /* 명단 */
    var tbody = $('#userTable').querySelector('tbody');
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="dtable__empty">아직 로그인한 사용자가 없습니다.</td></tr>';
    } else {
      tbody.innerHTML = users.map(function (u) {
        var p = u.profile;
        var chart = p && p.year
          ? p.year + '.' + String(p.month).padStart(2, '0') + '.' + String(p.day).padStart(2, '0') +
            (p.unknownTime ? ' (시각 미상)' : '')
          : '—';
        return '<tr>' +
          '<td>' + esc(u.displayName) + '</td>' +
          '<td class="dtable__mono">' + esc(u.email) + '</td>' +
          '<td class="dtable__mono">' + fmtDate(u.createdAt) + '</td>' +
          '<td class="dtable__mono">' + fmtDate(u.lastSeenAt) + '</td>' +
          '<td class="num dtable__mono">' + (u.visits || 0) + '</td>' +
          '<td class="dtable__mono">' + esc(chart) + '</td>' +
        '</tr>';
      }).join('');
    }

    $('#userNote').textContent =
      '명단은 최근 접속 순입니다. 저장된 명식은 사용자가 "이 브라우저에 기억해 두기"를 켠 경우에만 남습니다. ' +
      '최대 200명까지 표시합니다.';

    gate.hidden = true;
    body.hidden = false;
  }

  if (!Auth) {
    showGate('인증 모듈을 불러오지 못했습니다.');
    return;
  }

  Auth.onChange(function (s) {
    if (!s.configured) {
      showGate('아직 백엔드가 연결되지 않았습니다. ' +
        '<code>assets/js/firebase-config.js</code> 를 채우고 <code>SETUP.md</code> 의 절차를 따르세요.');
      return;
    }
    if (!s.ready) { showGate('확인 중…'); return; }
    if (s.error) { showGate('오류: ' + esc(s.error)); return; }
    if (!s.user) {
      showGate('이 화면은 관리자 전용입니다. 왼쪽 아래에서 <b>구글로 로그인</b> 해 주세요.');
      return;
    }
    if (!s.user.isAdmin) {
      showGate('관리자 권한이 없는 계정입니다.<br>' +
        '<span class="micro">UID ' + esc(s.user.uid) + '</span><br>' +
        '이 UID 를 <code>firebase-config.js</code> 의 <code>adminUids</code> 와 ' +
        '<code>firestore.rules</code> 의 <code>adminUids()</code> 양쪽에 넣어야 합니다.');
      return;
    }
    load().catch(function (e) {
      console.error(e);
      showGate('데이터를 불러오지 못했습니다: ' + esc(e && e.message ? e.message : e));
    });
  });

  var reload = $('#reloadBtn');
  if (reload) {
    reload.addEventListener('click', function () {
      load().catch(function (e) { showGate('불러오기 실패: ' + esc(e.message)); });
    });
  }
})(window);
