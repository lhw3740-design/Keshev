// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.

// ---------- 마지막 총공세: 내 PC 상태(학생 작성) ----------
// 서버의 학생 모듈(src/student-pc/collector.mjs)이 이 PC에서 실제로 잰 값만 보여 준다. 예시 값은 쓰지 않는다.
// 사용자가 버튼을 눌렀을 때만 조회하고(자동 반복 없음), 늦게 도착한 이전 응답은 세대 번호로 버린다.
const PC_TIMEOUT_MS = 9000;
function createPcPanel() {
  let state = { status: 'idle' };
  let generation = 0;
  let controller = null;
  const element = document.createElement('section');
  element.className = 'student-pc';
  element.setAttribute('aria-labelledby', 'student-pc-title');

  const text = (value, fallback = '확인 불가') => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback);
  const fmtBytes = (n) => {
    if (!Number.isFinite(n) || n < 0) return '확인 불가';
    const units = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v.toFixed(i >= 3 ? 1 : 0)} ${units[i]}`;
  };
  const fmtTime = (iso) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? `${d.toLocaleString('ko-KR', { hour12: false })} (${iso})` : '확인 불가';
  };
  const line = (parent, label, value, className = '') => {
    const p = document.createElement('p');
    if (className) p.className = className;
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    const span = document.createElement('span');
    span.textContent = value;
    p.append(strong, span);
    parent.append(p);
    return p;
  };
  const note = (parent, message, className = 'muted', role = null) => {
    const p = document.createElement('p');
    p.className = className;
    if (role) p.setAttribute('role', role);
    p.textContent = message;
    parent.append(p);
  };
  // 대시보드 타일: 제목·상태 배지·큰 값 하나를 먼저 보여 주고, 세부 값과 잰 시각·방법은 접어 둔다.
  const card = (title, item, renderOk) => {
    const box = document.createElement('section');
    box.className = 'student-pc-item';
    Object.assign(box.style, { border: '1px solid currentColor', borderRadius: '10px', padding: '10px 12px', minWidth: '0' });
    const h = document.createElement('h5');
    h.style.margin = '0 0 6px';
    box.append(h);
    if (item?.status === 'ok') {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '자세히 · 잰 시각·방법';
      details.append(summary);
      const { level = 'ok', headline = '' } = renderOk(details, item) || {};
      const badge = level === 'warn' ? '▲ 주의' : '● 정상';
      box.setAttribute('data-student-pc-level', level);
      h.textContent = `${title} · ${badge} · 실측`;
      const big = document.createElement('p');
      big.className = 'student-pc-headline';
      Object.assign(big.style, { fontSize: '1.5rem', fontWeight: '700', margin: '0 0 6px' });
      big.textContent = headline;
      line(details, '잰 시각', fmtTime(item.measuredAt), 'muted');
      line(details, '잰 방법', text(item.method), 'muted');
      box.append(big, details);
    } else {
      box.setAttribute('data-student-pc-level', 'unavailable');
      h.textContent = `${title} · ? 확인 불가`;
      const big = document.createElement('p');
      Object.assign(big.style, { fontSize: '1.5rem', fontWeight: '700', margin: '0 0 6px' });
      big.textContent = '확인 불가';
      box.append(big);
      line(box, '이유', `${text(item?.message, '값을 읽지 못했습니다.')} (${text(item?.code, 'UNKNOWN')})`, 'state state-error');
      note(box, '값을 읽지 못했다는 뜻이며, 정상이나 0으로 보지 않습니다.');
    }
    return box;
  };

  function render() {
    element.replaceChildren();
    element.setAttribute('data-student-pc-status', state.status);
    const title = document.createElement('h4');
    title.id = 'student-pc-title';
    title.textContent = '내 PC 상태 (이 PC에서 실제로 잰 값)';
    element.append(title);
    note(element, '앱 서버가 이 PC에서 읽기 전용으로 잰 값입니다. 설명용 예시 값은 표시하지 않으며, 읽지 못한 항목은 「확인 불가」로 남깁니다.');

    const controls = document.createElement('div');
    controls.className = 'student-pc-controls';
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = state.status === 'idle' ? '내 PC 상태 조회' : '다시 조회';
    load.setAttribute('aria-label', load.textContent);
    load.disabled = state.status === 'loading';
    load.addEventListener('click', () => { refresh(); });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '조회 취소';
    cancel.disabled = state.status !== 'loading';
    cancel.addEventListener('click', () => { cancelRefresh(); });
    controls.append(load, cancel);
    element.append(controls);

    if (state.status === 'idle') {
      note(element, '아직 조회하지 않았습니다. 「내 PC 상태 조회」를 누르면 한 번 잽니다. 자동으로 반복 조회하지 않습니다.', 'state state-empty', 'status');
      return;
    }
    if (state.status === 'loading') {
      note(element, '이 PC 상태를 재는 중입니다… (최대 약 9초) 이전 결과는 현재 값이 아니므로 표시하지 않습니다.', 'state state-loading', 'status');
      return;
    }
    if (state.status === 'error') {
      if (state.error?.code === 'CANCELLED') {
        note(element, '조회 취소됨: 이번 조회를 멈췄습니다. 이전 결과는 현재 값이 아니므로 표시하지 않습니다. 필요하면 「다시 조회」를 누르세요.', 'state state-empty', 'status');
        return;
      }
      note(element, `조회 실패: ${text(state.error?.message, '내 PC 상태를 가져오지 못했습니다.')} (${text(state.error?.code, 'UNKNOWN')})`, 'state state-error', 'alert');
      const steps = document.createElement('ol');
      for (const step of ['앱을 켠 PowerShell 창이 아직 열려 있는지 확인합니다.', '창에 오류가 보이면 그 메시지를 확인합니다.', '「다시 조회」를 직접 누릅니다. 계속 실패하면 도움정보와 함께 담당자에게 알립니다.']) {
        const li = document.createElement('li'); li.textContent = step; steps.append(li);
      }
      element.append(steps);
      note(element, '조회 실패는 PC가 정상이라는 뜻도, 문제가 있다는 뜻도 아닙니다.');
      return;
    }

    const data = state.data;
    line(element, '조회 시작~끝', `${fmtTime(data.startedAt)} ~ ${fmtTime(data.finishedAt)}`, 'muted');
    if (data.hostKind !== 'windows') note(element, 'Windows 가 아닌 환경이라 방화벽·이벤트 등 일부 항목은 읽지 않습니다.', 'state state-error');
    const grid = document.createElement('div');
    grid.className = 'student-pc-grid';
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', margin: '8px 0' });
    const items = data.items || {};

    grid.append(card('CPU', items.cpu, (box, it) => {
      line(box, '논리 코어', String(it.logicalCores));
      line(box, '모델', text(it.model));
      return { level: it.usagePercent >= 90 ? 'warn' : 'ok', headline: `사용률 ${it.usagePercent}%` };
    }));
    grid.append(card('메모리', items.memory, (box, it) => {
      line(box, '사용 중', `${fmtBytes(it.usedBytes)} / ${fmtBytes(it.totalBytes)}`);
      line(box, '남은 양', fmtBytes(it.freeBytes));
      return { level: it.usagePercent >= 90 ? 'warn' : 'ok', headline: `사용 ${it.usagePercent}%` };
    }));
    grid.append(card('디스크', items.disk, (box, it) => {
      line(box, '드라이브', text(it.drive));
      line(box, '남은 공간', `${fmtBytes(it.freeBytes)} / ${fmtBytes(it.totalBytes)}`);
      return { level: it.freePercent < 10 ? 'warn' : 'ok', headline: `${text(it.drive)} 남음 ${it.freePercent}%` };
    }));
    grid.append(card('네트워크', items.network, (box, it) => {
      const adapters = Array.isArray(it.adapters) ? it.adapters : [];
      line(box, '사용 중 어댑터', adapters.length ? adapters.map((a) => `${text(a.name)}(${a.ipv4 ? 'IPv4' : ''}${a.ipv4 && a.ipv6 ? '·' : ''}${a.ipv6 ? 'IPv6' : ''})`).join(', ') : '없음');
      if (Array.isArray(it.profiles)) {
        line(box, '연결 프로필', it.profiles.length ? it.profiles.map((p) => `${text(p.alias)}: ${text(p.category)} · IPv4 ${text(p.ipv4)}`).join(' / ') : '없음');
      } else {
        line(box, '연결 프로필', `확인 불가 (${text(it.profileCode, 'UNKNOWN')})`, 'state state-error');
      }
      const online = Array.isArray(it.profiles) && it.profiles.some((p) => p.ipv4 === 'Internet' || p.ipv6 === 'Internet');
      const known = Array.isArray(it.profiles);
      return { level: online ? 'ok' : 'warn', headline: online ? '인터넷 연결됨' : known ? '인터넷 연결 없음' : '연결 프로필 확인 불가' };
    }));
    grid.append(card('방화벽', items.firewall, (box, it) => {
      const profiles = Array.isArray(it.profiles) ? it.profiles : [];
      const label = (v) => (v === 'True' ? '켜짐' : v === 'False' ? '꺼짐' : `확인 불가(${text(v, '값 없음')})`);
      for (const p of profiles) line(box, `${text(p.name)} 프로필`, label(p.enabled));
      const on = profiles.filter((p) => p.enabled === 'True').length;
      return { level: on === profiles.length ? 'ok' : 'warn', headline: `${profiles.length}개 중 ${on}개 켜짐` };
    }));
    grid.append(card(`Windows 기록 (최근 ${Number(items.events?.windowHours) || 24}시간)`, items.events, (box, it) => {
      let warn = false;
      for (const log of Array.isArray(it.logs) ? it.logs : []) {
        if (log.status === 'ok') {
          line(box, `${text(log.log)} 로그`, `오류 ${log.errors}건 · 경고 ${log.warnings}건${log.capped ? ' (상한까지만 셈, 실제는 더 많을 수 있음)' : ''}`);
          if (log.errors > 0) warn = true;
        } else {
          line(box, `${text(log.log)} 로그`, `확인 불가 (${text(log.code, 'UNKNOWN')})`, 'state state-error');
        }
      }
      note(box, '건수만 셉니다. 이벤트 본문은 읽어 오거나 보여 주지 않습니다.');
      const okLogs = (Array.isArray(it.logs) ? it.logs : []).filter((l) => l.status === 'ok');
      const errors = okLogs.reduce((n, l) => n + l.errors, 0);
      const warnings = okLogs.reduce((n, l) => n + l.warnings, 0);
      return { level: warn ? 'warn' : 'ok', headline: okLogs.length ? `오류 ${errors} · 경고 ${warnings}` : '확인 불가' };
    }));
    element.append(grid);
    note(element, '▲ 주의 기준(학생이 정한 값): CPU·메모리 90% 이상, 디스크 남은 공간 10% 미만, 꺼진 방화벽 프로필, 인터넷 연결 프로필 없음, 기록 오류 1건 이상. 주의는 점검을 권하는 표시이며 장애 판정이 아닙니다.');
  }

  async function refresh() {
    const gen = ++generation;
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    const timer = setTimeout(() => ctrl.abort(), PC_TIMEOUT_MS);
    state = { status: 'loading' };
    render();
    let next;
    try {
      const response = await fetch('/api/student/pc-status', { headers: { accept: 'application/json' }, cache: 'no-store', signal: ctrl.signal });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok === true && body.data && typeof body.data === 'object' && body.data.items) {
        next = { status: 'ok', data: body.data };
      } else {
        next = { status: 'error', error: { code: text(body?.error?.code, `HTTP_${response.status}`), message: text(body?.error?.message, '서버가 내 PC 상태를 돌려주지 않았습니다.') } };
      }
    } catch (error) {
      next = error?.name === 'AbortError'
        ? { status: 'error', error: ctrl.cancelledByUser ? { code: 'CANCELLED', message: '조회를 취소했습니다. 이전 결과는 현재 값이 아닙니다.' } : { code: 'TIMEOUT', message: '조회 시간이 초과됐습니다.' } }
        : { status: 'error', error: { code: 'NETWORK_ERROR', message: '앱 서버에 연결할 수 없습니다.' } };
    } finally {
      clearTimeout(timer);
    }
    if (gen !== generation) return; // 더 새 조회나 취소가 있으면 늦은 응답은 버린다.
    controller = null;
    state = next;
    render();
  }
  function cancelRefresh() {
    if (!controller) return;
    controller.cancelledByUser = true;
    controller.abort();
  }

  render();
  return { element };
}

export function createStudentView() {
  const pcPanel = createPcPanel();
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('section');
      root.className = 'student-identity';

      const heading = document.createElement('h3');
      heading.textContent = '내 계정·기기·세션';
      root.append(heading);

      const modeText = (resource) => {
        if (resource?.mode === 'demo') return ' · 예제 자료(demo)';
        if (resource?.mode === 'disconnected') return ' · 연결 없음';
        if (resource?.mode === 'unknown') return ' · 연결 상태 확인 불가';
        return '';
      };
      const textValue = (value, fallback = '확인 불가') =>
        typeof value === 'string' && value.length > 0 ? value : fallback;
      const stateDescription = (kind, value) => {
        const labels = kind === 'device'
          ? { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' }
          : { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
        return `${labels[value] || '확인 불가'} (${textValue(value, 'unknown')})`;
      };
      const addLine = (parent, label, value) => {
        const line = document.createElement('p');
        const name = document.createElement('strong');
        name.textContent = `${label}: `;
        line.append(name, document.createTextNode(value));
        parent.append(line);
      };
      const addGroup = (title, resource, renderOk) => {
        const group = document.createElement('section');
        group.className = 'student-identity-group';
        const titleNode = document.createElement('h4');
        titleNode.textContent = title;
        group.append(titleNode);

        if (!resource || resource.status === 'loading') {
          const message = document.createElement('p');
          message.setAttribute('role', 'status');
          message.textContent = `불러오는 중${modeText(resource)}…`;
          group.append(message);
        } else if (resource.status === 'error') {
          const message = document.createElement('p');
          message.className = 'state state-error';
          const detail = typeof resource.error?.message === 'string' && resource.error.message
            ? resource.error.message
            : '요청에 실패했습니다.';
          message.textContent = `확인 불가 · 불러오지 못했습니다: ${detail}${modeText(resource)}`;
          group.append(message);
        } else if (resource.status === 'ok') {
          const mode = modeText(resource);
          renderOk(group, resource.data);
          if (mode) {
            const note = document.createElement('p');
            note.className = 'muted';
            note.textContent = mode.trim();
            group.append(note);
          }
        } else {
          const message = document.createElement('p');
          message.className = 'state state-error';
          message.textContent = `확인 불가 · 자료 상태를 확인할 수 없습니다${modeText(resource)}`;
          group.append(message);
        }
        root.append(group);
      };

      addGroup('현재 로그인 정보', me, (group, data) => {
        const user = data?.user;
        const device = data?.device;
        const session = data?.session;
        addLine(group, '사용자', `${textValue(user?.label)} · ID ${textValue(user?.id)}`);
        addLine(group, '현재 기기', `${textValue(device?.label)} · ID ${textValue(device?.id)} · ${stateDescription('device', device?.status)}`);
        addLine(group, '현재 세션', `ID ${textValue(session?.id)} · ${stateDescription('session', session?.status)}`);
      });

      addGroup('내 기기 목록', devices, (group, data) => {
        if (!Array.isArray(data) || data.length === 0) {
          const message = document.createElement('p');
          message.textContent = Array.isArray(data) ? '표시할 기기가 없습니다.' : '기기 목록을 확인할 수 없습니다.';
          group.append(message);
          return;
        }
        const list = document.createElement('ul');
        for (const device of data) {
          const item = document.createElement('li');
          item.textContent = `${textValue(device?.label)} · ID ${textValue(device?.id)} · ${stateDescription('device', device?.status)}`;
          list.append(item);
        }
        group.append(list);
      });

      addGroup('내 세션 목록', sessions, (group, data) => {
        if (!Array.isArray(data) || data.length === 0) {
          const message = document.createElement('p');
          message.textContent = Array.isArray(data) ? '표시할 세션이 없습니다.' : '세션 목록을 확인할 수 없습니다.';
          group.append(message);
          return;
        }
        const list = document.createElement('ul');
        for (const session of data) {
          const item = document.createElement('li');
          item.textContent = `ID ${textValue(session?.id)} · ${stateDescription('session', session?.status)}`;
          list.append(item);
        }
        group.append(list);
      });

      return root;
    },
    renderDecision({ status = 'idle', mode = 'unknown', data, error, appId } = {}) {
      const root = document.createElement('section');
      root.className = 'student-decision';

      const heading = document.createElement('h3');
      heading.textContent = '업무 앱 접근 판정';
      root.append(heading);

      const textValue = (value, fallback = '확인 불가') =>
        typeof value === 'string' && value.length > 0 ? value : fallback;
      const addLine = (label, value) => {
        const line = document.createElement('p');
        const name = document.createElement('strong');
        name.textContent = `${label}: `;
        const detail = document.createElement('span');
        detail.textContent = value;
        line.append(name, detail);
        root.append(line);
      };
      const addStatus = (message, role = 'status', className = '') => {
        const line = document.createElement('p');
        line.setAttribute('role', role);
        if (className) line.className = className;
        line.textContent = message;
        root.append(line);
      };
      const modeNotes = {
        demo: '예제 자료(demo)이며 실제 연결 결과가 아닙니다.',
        disconnected: '연결 없음: 실제 서버 판정을 확인할 수 없습니다.',
        unknown: '연결 상태 확인 불가: 결과를 실제 판정으로 단정하지 마세요.',
      };
      if (modeNotes[mode]) addStatus(modeNotes[mode], 'status', 'muted');

      if (appId != null || data?.appId != null) {
        addLine('업무 앱 ID', textValue(data?.appId, textValue(appId)));
      }

      if (status === 'idle') {
        addStatus('요청 전입니다. 업무 앱 하나를 선택한 뒤 접근 요청을 하세요.');
      } else if (status === 'loading') {
        addStatus('접근 판정을 확인하는 중입니다…');
      } else if (status === 'error') {
        const detail = textValue(error?.message, '요청에 실패했습니다.');
        addStatus(`요청 실패: ${detail} 접근 거부 판정이 아닙니다.`, 'alert', 'state state-error');
      } else if (status === 'ok') {
        if (!data || typeof data !== 'object') {
          addStatus('판정 자료를 확인할 수 없습니다. 허용으로 간주하지 마세요.', 'status', 'state state-error');
          addLine('판정 이유', '확인 불가');
          addLine('판정 시각', '확인 불가');
        } else {
          const decision = typeof data.decision === 'string' && data.decision.length > 0
            ? data.decision
            : 'unknown';
          const decisionLabels = {
            allow: '접근 허용 (allow)',
            deny: '접근 거부 (deny)',
            challenge: '추가 확인 필요 (challenge)',
            unknown: '판정 확인 불가 (unknown)',
          };
          if (Object.hasOwn(decisionLabels, decision)) {
            addStatus(decisionLabels[decision], 'status', decision === 'deny' || decision === 'unknown' ? 'state state-error' : '');
          } else {
            addStatus(`판정 확인 불가 (unknown; 원래 값: ${decision}) 허용으로 간주하지 마세요.`, 'status', 'state state-error');
          }
          addLine('판정 이유', textValue(data.reason));
          addLine('판정 시각', textValue(data.checkedAt));
        }
      } else {
        addStatus('판정 상태를 확인할 수 없습니다. 허용으로 간주하지 마세요.', 'status', 'state state-error');
      }

      const limitation = document.createElement('p');
      limitation.className = 'muted';
      limitation.textContent = '허용은 정책상 접근 허용 판정이며 실제 앱 접속 성공을 보장하지 않습니다. 추가 확인(challenge)은 이 앱이 인증을 대신 수행한다는 뜻이 아니며, 이 화면은 전체 업무 앱 권한 목록을 조회하지 않습니다.';
      root.append(limitation);
      return root;
    },
    renderEvents({ status = 'loading', mode = 'unknown', data, error } = {}) {
      const root = document.createElement('section');
      root.className = 'student-events';

      const heading = document.createElement('h3');
      heading.textContent = '내 접속 기록·XDR 경보';
      root.append(heading);

      const addMessage = (message, role = 'status', className = '') => {
        const node = document.createElement('p');
        node.setAttribute('role', role);
        if (className) node.className = className;
        node.textContent = message;
        root.append(node);
        return node;
      };
      const modeNotes = {
        demo: '예제 자료(demo)이며 실제 접속 기록이나 XDR 경보가 아닙니다.',
        disconnected: '연결 없음: 실제 기록을 확인할 수 없습니다.',
        unknown: '연결 상태 확인 불가: 기록의 출처를 확인할 수 없습니다.',
      };
      if (modeNotes[mode]) addMessage(modeNotes[mode], 'status', 'muted');

      if (status === 'loading') {
        addMessage('기록을 불러오는 중…');
        return root;
      }
      if (status === 'error') {
        const detail = typeof error?.message === 'string' && error.message.length > 0
          ? error.message
          : '요청에 실패했습니다.';
        if (error?.code === 'CONTRACT_MISMATCH') {
          addMessage(`확인 불가 (CONTRACT_MISMATCH). 기록을 불러오지 못했습니다: ${detail}`, 'alert', 'state state-error');
        } else {
          addMessage(`기록을 불러오지 못했습니다: ${detail}`, 'alert', 'state state-error');
        }
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)) {
        addMessage('확인 불가: 기록 응답을 확인할 수 없습니다. 이전 목록은 표시하지 않습니다.', 'alert', 'state state-error');
        return root;
      }

      // 받은 서버 배열은 수정하지 않고 복사본만 최신순으로 정렬한다.
      const events = [...data].sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
      const filters = { kind: 'all', appId: 'all', access: 'all' };
      let selectedEventId = null;

      const filterGroup = document.createElement('div');
      filterGroup.className = 'student-event-filters';
      const makeFilter = (id, labelText, key, values, labelForValue) => {
        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.textContent = labelText;
        const select = document.createElement('select');
        select.id = id;
        select.setAttribute('aria-label', labelText);
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = '전체';
        select.append(allOption);
        for (const value of values) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = labelForValue(value);
          select.append(option);
        }
        select.addEventListener('change', () => {
          filters[key] = select.value;
          renderList();
        });
        label.append(select);
        filterGroup.append(label);
      };
      const uniqueValues = (values) => [...new Set(values)];
      makeFilter('student-event-kind-filter', '기록 종류', 'kind',
        uniqueValues(events.map((event) => event.kind)),
        (value) => value === 'access' ? '접속 기록' : value === 'xdr' ? 'XDR 경보' : value);
      makeFilter('student-event-app-filter', '업무 앱', 'appId',
        uniqueValues(events.map((event) => event.appId ?? '')),
        (value) => value === '' ? '앱을 확인할 수 없음' : value);
      makeFilter('student-event-access-filter', '접속 상태', 'access',
        uniqueValues(events.map((event) => event.state?.access ?? 'unknown')),
        (value) => `${({ allowed: '허용됨', denied: '거부됨', unknown: '확인 불가' })[value] || '확인 불가'} (${value})`);
      root.append(filterGroup);

      const count = document.createElement('p');
      count.className = 'student-event-count';
      count.setAttribute('aria-live', 'polite');
      root.append(count);

      const list = document.createElement('ul');
      list.className = 'student-event-list';
      root.append(list);

      const detailContainer = document.createElement('div');
      detailContainer.className = 'student-event-detail-container';
      root.append(detailContainer);

      const textValue = (value, fallback = '확인 불가') =>
        typeof value === 'string' && value.length > 0 ? value : fallback;
      const filteredEvents = () => events.filter((event) => {
        const appValue = event.appId ?? '';
        const accessValue = event.state?.access ?? 'unknown';
        return (filters.kind === 'all' || event.kind === filters.kind)
          && (filters.appId === 'all' || appValue === filters.appId)
          && (filters.access === 'all' || accessValue === filters.access);
      });
      const addDetailLine = (parent, labelText, value) => {
        const line = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = `${labelText}: `;
        const content = document.createElement('span');
        content.textContent = value;
        line.append(label, content);
        parent.append(line);
      };
      const stateDescription = (kind, value) => {
        const labels = {
          access: { allowed: '허용됨', denied: '거부됨', unknown: '확인 불가' },
          session: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
          device: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
        };
        const original = textValue(value, 'unknown');
        if (original === 'unknown') return '확인 불가(unknown)';
        return `${labels[kind]?.[original] || '확인 불가'} (${original})`;
      };
      const appendTextRows = (parent, titleText, rows) => {
        const section = document.createElement('section');
        const title = document.createElement('h5');
        title.textContent = titleText;
        section.append(title);
        if (!Array.isArray(rows) || rows.length === 0) {
          const empty = document.createElement('p');
          empty.textContent = '표시할 항목이 없습니다.';
          section.append(empty);
        } else {
          const items = document.createElement('ul');
          for (const row of rows) {
            const item = document.createElement('li');
            item.textContent = `ID ${textValue(row?.id)} · ${textValue(row?.text, '내용 확인 불가')}`;
            items.append(item);
          }
          section.append(items);
        }
        parent.append(section);
      };
      const showDetail = (event) => {
        selectedEventId = event.id;
        detailContainer.replaceChildren();
        const detail = document.createElement('section');
        detail.className = 'student-event-detail';
        detail.setAttribute('data-student-event-detail', event.id);
        const title = document.createElement('h4');
        title.textContent = `${event.id} 상세`;
        detail.append(title);
        addDetailLine(detail, '사건 ID', event.id);
        addDetailLine(detail, '업무 앱 ID', event.appId == null ? '앱을 확인할 수 없음' : event.appId);
        appendTextRows(detail, '근거(evidence)', event.evidence);
        appendTextRows(detail, '규칙(rules)', event.rules);

        const stateSection = document.createElement('section');
        const stateHeading = document.createElement('h5');
        stateHeading.textContent = '상태(state)';
        stateSection.append(stateHeading);
        addDetailLine(stateSection, '접속 상태(access)', stateDescription('access', event.state?.access));
        addDetailLine(stateSection, '세션 상태(session)', stateDescription('session', event.state?.session));
        addDetailLine(stateSection, '기기 상태(device)', stateDescription('device', event.state?.device));
        detail.append(stateSection);

        // 지원되지 않는 조치는 상세에만 비활성 안내로 표시하며, 어떤 요청도 전송하지 않는다.
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          const actionsSection = document.createElement('section');
          const actionsHeading = document.createElement('h5');
          actionsHeading.textContent = '조치 지원 상태';
          const explanation = document.createElement('p');
          explanation.textContent = '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중입니다.';
          actionsSection.append(actionsHeading, explanation);
          for (const action of event.supportedActions) {
            if (typeof action !== 'string' || action.length === 0) continue;
            const button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.textContent = `${action} 미지원`;
            button.setAttribute('aria-label', `${action} 미지원`);
            actionsSection.append(button);
          }
          detail.append(actionsSection);
        }
        detailContainer.append(detail);
      };
      const renderList = () => {
        const visible = filteredEvents();
        count.textContent = `표시 건수: ${visible.length}건`;
        list.replaceChildren();
        for (const event of visible) {
          const item = document.createElement('li');
          item.setAttribute('data-student-event-id', event.id);

          const eventId = document.createElement('p');
          eventId.textContent = `사건 ID: ${event.id}`;
          const time = document.createElement('p');
          time.textContent = `시각: ${textValue(event.at)}`;
          const kind = document.createElement('p');
          kind.textContent = `종류: ${event.kind === 'access' ? '접속 기록' : event.kind === 'xdr' ? 'XDR 경보' : event.kind}`;
          const app = document.createElement('p');
          app.textContent = `업무 앱: ${event.appId == null ? '앱을 확인할 수 없음' : event.appId}`;
          const summary = document.createElement('p');
          summary.textContent = `요약: ${textValue(event.summary, '요약 확인 불가')}`;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `${event.id} 상세`;
          button.setAttribute('aria-label', `${event.id} 상세`);
          button.setAttribute('aria-expanded', String(selectedEventId === event.id));
          button.addEventListener('click', () => showDetail(event));
          item.append(eventId, time, kind, app, summary, button);
          list.append(item);
        }
        if (visible.length === 0) {
          const empty = document.createElement('li');
          empty.textContent = '필터 조건에 맞는 기록이 없습니다.';
          list.append(empty);
        }
        if (selectedEventId && !visible.some((event) => event.id === selectedEventId)) {
          selectedEventId = null;
          detailContainer.replaceChildren();
        } else if (selectedEventId) {
          const selected = visible.find((event) => event.id === selectedEventId);
          if (selected && detailContainer.firstElementChild) {
            const selectedButton = [...list.querySelectorAll('button')].find((button) => button.textContent === `${selectedEventId} 상세`);
            if (selectedButton) selectedButton.setAttribute('aria-expanded', 'true');
          }
        }
      };

      if (events.length === 0) addMessage('표시할 기록이 없습니다.');
      renderList();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode = 'unknown' } = {}) {
      const root = document.createElement('section');
      root.className = 'student-status';

      const heading = document.createElement('h3');
      heading.textContent = '기기·세션·알림·도움정보 상태';
      root.append(heading);

      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || value.trim().length === 0) return fallback;
        return value.slice(0, 2000)
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
          .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, '[비밀값 제거]')
          .replace(/\b(?:github_pat_|gh[pousr]_|sk-(?:proj-|ant-|svcacct-)?)[A-Za-z0-9_-]{8,}\b/gi, '[비밀값 제거]')
          .replace(/\b(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*[^\s,;]+/gi, '[비밀값 제거]')
          .trim() || fallback;
      };
      const addLine = (parent, labelText, value) => {
        const line = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = `${labelText}: `;
        const detail = document.createElement('span');
        detail.textContent = value;
        line.append(label, detail);
        parent.append(line);
      };
      const addMessage = (parent, message, className = 'muted') => {
        const line = document.createElement('p');
        line.className = className;
        line.textContent = message;
        parent.append(line);
      };
      const modeLabels = {
        connected: '연결됨',
        demo: '예제 자료(demo) · 실제 연결 결과가 아닙니다.',
        disconnected: '연결 없음',
        unknown: '연결 상태 확인 불가',
      };
      addMessage(root, `연결 모드: ${modeLabels[mode] || '연결 상태 확인 불가'}`);

      const deviceStatus = (value) => {
        const labels = {
          compliant: '보안 기준 충족',
          noncompliant: '보안 기준 미충족',
          unknown: '확인 불가',
        };
        const original = safeText(value, 'unknown');
        return `${labels[original] || '확인 불가'} (${original})`;
      };
      const sessionStatus = (value) => {
        const labels = {
          active: '활성',
          expired: '만료',
          revoked: '철회됨',
          unknown: '확인 불가',
        };
        const original = safeText(value, 'unknown');
        return `${labels[original] || '확인 불가'} (${original})`;
      };
      const addCollection = (titleText, resource, kind) => {
        const group = document.createElement('section');
        group.className = 'student-status-group';
        const title = document.createElement('h4');
        title.textContent = titleText;
        group.append(title);

        if (!resource || resource.status === 'loading') {
          addMessage(group, `${titleText}을 불러오는 중입니다.`, 'state state-loading');
        } else if (resource.status === 'error') {
          const code = safeText(resource.error?.code, '');
          const message = safeText(resource.error?.message, '요청에 실패했습니다.');
          const timeout = ['TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT'].includes(code)
            || /시간 초과|timed?\s*out|timeout/i.test(message);
          addMessage(group, timeout
            ? `${titleText} 조회 시간 초과: ${message}`
            : `${titleText}을 불러오지 못했습니다: ${message}`, 'state state-error');
          if (code) addLine(group, '오류 코드', code);
          addMessage(group, '다시 시도하려면 위쪽 「다시 불러오기」 버튼을 직접 누르세요. 자동 재시도는 하지 않습니다.');
        } else if (resource.status === 'ok' && Array.isArray(resource.data)) {
          if (resource.data.length === 0) {
            addMessage(group, kind === 'devices' ? '등록된 기기가 없습니다.' : '현재 연결이 없습니다.', 'state state-empty');
          } else {
            const list = document.createElement('ul');
            for (const item of resource.data) {
              const row = document.createElement('li');
              if (kind === 'devices') {
                row.textContent = `${safeText(item?.label)} · 상태: ${deviceStatus(item?.status)}`;
              } else {
                row.textContent = `ID ${safeText(item?.id)} · 상태: ${sessionStatus(item?.status)}`;
              }
              list.append(row);
            }
            group.append(list);
          }
        } else if (resource.status === 'ok') {
          addMessage(group, `${titleText} 응답을 확인할 수 없습니다. 정상 또는 빈 목록으로 간주하지 않습니다.`, 'state state-error');
        } else {
          addMessage(group, `${titleText} 상태를 확인할 수 없습니다.`, 'state state-error');
        }

        if (kind === 'sessions') {
          addMessage(group, '세션은 현재 검증된 연결 한 개의 정보입니다. 과거 세션 목록이 아닙니다.');
        }
        root.append(group);
      };

      addCollection('기기', devices, 'devices');
      addCollection('세션', sessions, 'sessions');

      const noticeGroup = document.createElement('section');
      noticeGroup.className = 'student-status-group';
      const noticeHeading = document.createElement('h4');
      noticeHeading.textContent = '알림';
      noticeGroup.append(noticeHeading);
      if (Array.isArray(notifications) && notifications.length === 0) {
        addMessage(noticeGroup, '주의할 알림이 없습니다.', 'state state-empty');
      } else if (Array.isArray(notifications)) {
        const list = document.createElement('ul');
        const resourceLabels = {
          me: '로그인 정보', apps: '업무 앱', events: '보안 기록', devices: '기기',
          sessions: '세션', access: '접속 판정', diagnostics: '도움정보',
        };
        for (const notification of notifications) {
          const item = document.createElement('li');
          const resource = safeText(notification?.resource);
          const resourceLabel = resourceLabels[resource] || resource;
          item.textContent = `자료: ${resourceLabel} (${resource}) · 코드: ${safeText(notification?.code)} · ${safeText(notification?.message, '알림 내용을 확인할 수 없습니다.')}`;
          list.append(item);
        }
        noticeGroup.append(list);
      } else {
        addMessage(noticeGroup, '알림 상태를 확인할 수 없습니다.', 'state state-error');
      }
      root.append(noticeGroup);

      const diagnosticsGroup = document.createElement('section');
      diagnosticsGroup.className = 'student-status-group';
      const diagnosticsHeading = document.createElement('h4');
      diagnosticsHeading.textContent = '도움정보';
      diagnosticsGroup.append(diagnosticsHeading);
      addMessage(diagnosticsGroup, '도움 요청에 사용할 수 있는 진단 정보입니다. 비밀번호·토큰·API 키는 표시하거나 복사하지 않습니다.');

      let diagnosticsText = '';
      let diagnosticsReady = false;
      if (!diagnostics || diagnostics.status === 'idle') {
        addMessage(diagnosticsGroup, '도움정보를 아직 불러오지 않았습니다. 제공 화면의 「도움정보 불러오기」를 직접 누르세요.');
      } else if (diagnostics.status === 'loading') {
        addMessage(diagnosticsGroup, '도움정보를 불러오는 중입니다.', 'state state-loading');
      } else if (diagnostics.status === 'error') {
        addMessage(diagnosticsGroup, `도움정보를 불러오지 못했습니다: ${safeText(diagnostics.error?.message, '요청에 실패했습니다.')}`, 'state state-error');
        addMessage(diagnosticsGroup, '다시 확인하려면 제공 화면의 「도움정보 불러오기」 버튼을 직접 누르세요.');
      } else if (diagnostics.status === 'ok' && diagnostics.data && typeof diagnostics.data === 'object') {
        const data = diagnostics.data;
        const safeDiagnostics = {
          requestId: safeText(data.requestId),
          component: safeText(data.component),
          version: safeText(data.version),
          checkedAt: safeText(data.checkedAt),
          engine: {
            mode: safeText(data.engine?.mode),
            code: safeText(data.engine?.code),
          },
        };
        addLine(diagnosticsGroup, 'requestId', safeDiagnostics.requestId);
        addLine(diagnosticsGroup, 'component', safeDiagnostics.component);
        addLine(diagnosticsGroup, 'version', safeDiagnostics.version);
        addLine(diagnosticsGroup, 'checkedAt', safeDiagnostics.checkedAt);
        addLine(diagnosticsGroup, 'engine.mode', safeDiagnostics.engine.mode);
        addLine(diagnosticsGroup, 'engine.code', safeDiagnostics.engine.code);
        diagnosticsText = JSON.stringify(safeDiagnostics, null, 2);
        const preview = document.createElement('pre');
        preview.textContent = diagnosticsText;
        diagnosticsGroup.append(preview);
        diagnosticsReady = true;
      } else {
        addMessage(diagnosticsGroup, '진단 자료를 확인할 수 없습니다. 이전 진단 결과를 표시하지 않습니다.', 'state state-error');
      }

      const copyStatus = document.createElement('p');
      copyStatus.setAttribute('role', 'status');
      copyStatus.setAttribute('aria-live', 'polite');
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = '도움정보 복사';
      copyButton.setAttribute('aria-label', '도움정보 복사');
      copyButton.disabled = !diagnosticsReady;
      copyButton.addEventListener('click', async () => {
        if (!diagnosticsReady || !diagnosticsText) return;
        try {
          if (!globalThis.navigator?.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
          await globalThis.navigator.clipboard.writeText(diagnosticsText);
          copyStatus.textContent = '도움 요청에 사용할 안전한 진단 정보만 클립보드에 복사했습니다.';
        } catch {
          copyStatus.textContent = '자동 복사를 사용할 수 없습니다. 위에 표시된 항목만 직접 선택해 복사하세요.';
        }
      });
      diagnosticsGroup.append(copyButton, copyStatus);
      root.append(diagnosticsGroup);
      // 마지막 총공세: 같은 칸에 내 PC 상태 패널을 붙인다(패널 상태는 다시 그려도 유지).
      root.append(pcPanel.element);
      return root;
    },
    // 20단계: package-lock.json 기준 실제 설치 버전과 OSV 조회 결과를 대조해 표시한다.
    // 매 호출마다 새 요소를 만들어 반환하므로 조회 중·오류·새 조회 때 이전 표가 현재 결과처럼 남지 않는다.
    // 늦게 도착한 이전 요청의 응답은 제공 화면이 세대 번호로 버리며, 학생 함수는 받은 현재 입력만 그린다.
    renderVulnerabilities({ status = 'idle', mode = null, data, error } = {}) {
      const root = document.createElement('section');
      root.className = 'student-vulnerabilities';
      root.setAttribute('data-student-scan-status', typeof status === 'string' ? status : 'unknown');

      const heading = document.createElement('h3');
      heading.textContent = '사용 라이브러리 취약점 대조(OSV)';
      root.append(heading);

      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || value.trim().length === 0) return fallback;
        return value.slice(0, 500)
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
          .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, '[비밀값 제거]')
          .replace(/\b(?:github_pat_|gh[pousr]_|sk-(?:proj-|ant-|svcacct-)?)[A-Za-z0-9_-]{8,}\b/gi, '[비밀값 제거]')
          .replace(/\b(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*[^\s,;]+/gi, '[비밀값 제거]')
          .trim() || fallback;
      };
      const addMessage = (parent, text, role = 'status', className = '') => {
        const line = document.createElement('p');
        if (role) line.setAttribute('role', role);
        if (className) line.className = className;
        line.textContent = text;
        parent.append(line);
      };
      const addLine = (parent, labelText, value) => {
        const line = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = `${labelText}: `;
        const detail = document.createElement('span');
        detail.textContent = value;
        line.append(label, detail);
        parent.append(line);
      };
      // 설치된 정확한 버전만 인정한다. ^1.2.0·~1.2·>=1·* 같은 범위는 설치 버전으로 표시하지 않는다.
      const exactVersion = (value) => typeof value === 'string'
        && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value);
      const sourceText = (value) => {
        if (typeof value === 'string') return safeText(value);
        if (value && typeof value === 'object') {
          const parts = Object.entries(value)
            .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
            .map(([k, v]) => `${k}=${safeText(String(v))}`);
          return parts.length > 0 ? parts.join(', ') : '확인 불가';
        }
        return '확인 불가';
      };
      const retryGuide = '다시 조회하려면 보호 현황의 「설치 패키지 조회」 버튼을 직접 누르세요. 자동으로 다시 조회하지 않습니다.';
      const notSafeNote = 'OSV는 알려진 취약점 데이터베이스입니다. 알려진 항목이 없다는 결과만으로 패키지나 앱 전체가 안전하다고 보장하지 않습니다.';

      if (mode === 'demo') addMessage(root, '예제 자료(demo)이며 실제 프로젝트 조회 결과가 아닙니다.', 'status', 'muted');

      if (status === 'idle') {
        addMessage(root, '조회 전: 아직 설치 패키지를 조회하지 않았습니다. 이전 결과는 표시하지 않습니다.', 'status', 'state state-empty');
        addMessage(root, '보호 현황의 「설치 패키지 조회」 버튼을 직접 누르세요.', null, 'muted');
        return root;
      }
      if (status === 'loading') {
        addMessage(root, '조회 중: package-lock.json과 설치 패키지를 OSV와 대조하고 있습니다… 이전 표는 현재 결과가 아니므로 표시하지 않습니다.', 'status', 'state state-loading');
        addMessage(root, '조회를 멈추려면 「취소」를 누르세요. 취소 뒤 늦게 도착한 응답은 표시하지 않습니다.', null, 'muted');
        return root;
      }
      if (status === 'error') {
        addMessage(root, `조회 실패: ${safeText(error?.message, '패키지 조회를 확인할 수 없습니다.')}`, 'alert', 'state state-error');
        if (typeof error?.code === 'string' && error.code) addLine(root, '오류 코드', safeText(error.code));
        addMessage(root, '조회 실패는 "취약점 없음"이 아닙니다. 이전 조회 결과는 현재 결과로 표시하지 않습니다.', null, 'muted');
        addMessage(root, retryGuide, null, 'muted');
        return root;
      }
      if (status !== 'ok' || !data || typeof data !== 'object') {
        addMessage(root, '확인 불가: 조회 결과를 확인할 수 없습니다. "취약점 없음"으로 간주하지 마세요.', 'alert', 'state state-error');
        addMessage(root, retryGuide, null, 'muted');
        return root;
      }

      // 전체 조회 상태
      const scanLabels = {
        complete: '모두 조회(complete): 조회 대상 패키지를 모두 OSV와 대조했습니다.',
        partial: '일부 조회 실패(partial): 일부 패키지는 조회하지 못했습니다. 받은 취약점 ID는 그대로 표시합니다.',
        not_checked: '아직 조회 안 함(not_checked): 승인된 공개 조회 대상이 없어 조회하지 않았습니다. "취약점 없음"이 아닙니다.',
        not_configured: '조회 준비 미완료(not_configured): 조회 대상 프로젝트 설정이 필요합니다. 담당자가 준비하며 "취약점 없음"이 아닙니다.',
        unverifiable: 'lock 파일 확인 불가(unverifiable): package-lock.json을 확인할 수 없어 설치 버전을 대조하지 못했습니다. "취약점 없음"이 아닙니다.',
      };
      const scanStatus = typeof data.status === 'string' ? data.status : 'unknown';
      const scanOk = scanStatus === 'complete';
      addMessage(root, scanLabels[scanStatus] || `조회 상태 확인 불가(원래 값: ${safeText(scanStatus, 'unknown')}). "취약점 없음"으로 간주하지 마세요.`,
        scanOk ? 'status' : 'alert', scanOk ? 'state state-ok' : 'state state-error');
      addLine(root, '전체 조회 상태(data.status)', safeText(scanStatus, 'unknown'));
      if (data.lockfileVersion != null) addLine(root, 'lock 파일 버전(lockfileVersion)', safeText(String(data.lockfileVersion)));
      if (data.lockfileHash != null) addLine(root, 'lock 파일 해시(lockfileHash)', safeText(String(data.lockfileHash)));
      if (data.checkedAt != null) addLine(root, '조회 시각(checkedAt)', safeText(String(data.checkedAt)));
      addMessage(root, '버전은 package.json의 범위가 아니라 package-lock.json과 설치된 node_modules 메타데이터를 대조한 실제 설치 버전입니다.', null, 'muted');

      const packages = Array.isArray(data.packages) ? data.packages : null;
      if (!packages) {
        addMessage(root, '패키지 목록을 확인할 수 없습니다. "취약점 없음"으로 간주하지 마세요.', 'alert', 'state state-error');
        addMessage(root, retryGuide, null, 'muted');
        return root;
      }
      if (packages.length === 0) {
        addMessage(root, scanOk
          ? '조회 대상 패키지가 없습니다.'
          : '표시할 패키지가 없습니다. 조회하지 않았거나 확인할 수 없는 상태이며 "취약점 없음"이 아닙니다.', null, 'muted');
      } else {
        const rowLabels = {
          known_vulnerabilities: '알려진 항목 있음(known_vulnerabilities)',
          none_found: '알려진 항목 없음(none_found): 이 버전에 대해 조회 범위의 OSV에 알려진 항목이 없습니다',
          unverifiable: '조회 확인 불가(unverifiable)',
        };
        const list = document.createElement('ul');
        list.className = 'student-package-list';
        for (const pkg of packages) {
          const item = document.createElement('li');
          const name = typeof pkg?.name === 'string' && pkg.name ? pkg.name : null;
          const version = exactVersion(pkg?.version) ? pkg.version : null;
          item.setAttribute('data-student-package-name', name || 'unknown');
          item.setAttribute('data-student-package-version', version || 'unknown');

          const title = document.createElement('h4');
          title.textContent = `${name ? safeText(name) : '이름 확인 불가'}@${version || '정확한 버전 확인 불가'}`;
          item.append(title);
          addLine(item, '패키지(name)', name ? safeText(name) : '확인 불가');
          addLine(item, '설치 버전(version)', version || `정확한 설치 버전 확인 불가(원래 값: ${safeText(String(pkg?.version ?? ''), '없음')})`);

          const rowStatus = typeof pkg?.status === 'string' ? pkg.status : 'unknown';
          const vulns = Array.isArray(pkg?.vulnerabilities) ? pkg.vulnerabilities : [];
          let statusText = rowLabels[rowStatus] || `상태 확인 불가(원래 값: ${safeText(rowStatus, 'unknown')})`;
          if (rowStatus === 'unverifiable' && vulns.length > 0) statusText = '일부 확인·전체 조회 확인 불가(unverifiable): 받은 취약점 ID는 그대로 표시합니다';
          if (!version && rowStatus === 'none_found') statusText = '조회 확인 불가: 정확한 설치 버전을 확인할 수 없어 "알려진 항목 없음"으로 표시하지 않습니다';
          addLine(item, '조회 상태(status)', statusText);
          addLine(item, '출처(source)', sourceText(pkg?.source));
          addLine(item, '조회 시각(checkedAt)', pkg?.checkedAt != null ? safeText(String(pkg.checkedAt)) : '확인 불가');

          if (vulns.length > 0) {
            const vulnList = document.createElement('ul');
            vulnList.className = 'student-vulnerability-list';
            for (const vuln of vulns) {
              const vulnItem = document.createElement('li');
              const id = typeof vuln?.id === 'string' && vuln.id ? safeText(vuln.id) : 'ID 확인 불가';
              const modified = vuln?.modified != null ? safeText(String(vuln.modified)) : '확인 불가';
              vulnItem.setAttribute('data-student-vulnerability-id', id);
              vulnItem.textContent = `취약점 ID ${id} · 수정 시각(modified) ${modified}`;
              vulnList.append(vulnItem);
            }
            item.append(vulnList);
          } else if (rowStatus === 'known_vulnerabilities') {
            addMessage(item, '알려진 항목이 있다고 응답했지만 취약점 ID를 확인할 수 없습니다.', null, 'state state-error');
          }
          list.append(item);
        }
        root.append(list);
      }

      if (scanStatus === 'partial' || scanStatus === 'unverifiable') addMessage(root, retryGuide, null, 'muted');
      addMessage(root, notSafeNote, null, 'muted');
      addMessage(root, '취약점을 만들기 위해 의존성 버전을 임의로 낮추지 마세요. 조회 대상·허용 패키지 설정은 담당자가 준비합니다.', null, 'muted');
      return root;
    },
    // 17단계: AI 연결 점검 결과 표시.
    // 매 호출마다 새 요소를 만들어 반환하므로 이전 점검 결과·오류 안내는 남지 않는다.
    // 자동 재점검은 하지 않으며, 다시 점검은 사용자가 「현재 API 연결 점검」 버튼을 직접 누른다.
    renderAiConnection({ status = 'idle', mode = null, data, error, checkedAt = null, explanationAccepted = false } = {}) {
      const root = document.createElement('section');
      root.className = 'student-ai-connection';
      root.setAttribute('data-student-ai-status', typeof status === 'string' ? status : 'unknown');

      const heading = document.createElement('h3');
      heading.textContent = '앱 내부 AI 연결 상태';
      root.append(heading);

      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || value.trim().length === 0) return fallback;
        return value.slice(0, 500)
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
          .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, '[비밀값 제거]')
          .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[비밀값 제거]')
          .replace(/\b(?:github_pat_|gh[pousr]_|sk-(?:proj-|ant-|svcacct-)?)[A-Za-z0-9_-]{8,}\b/gi, '[비밀값 제거]')
          .replace(/\b(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*[^\s,;]+/gi, '[비밀값 제거]')
          .trim() || fallback;
      };
      const addMessage = (message, role = 'status', className = '') => {
        const line = document.createElement('p');
        if (role) line.setAttribute('role', role);
        if (className) line.className = className;
        line.textContent = message;
        root.append(line);
        return line;
      };
      const addLine = (labelText, value) => {
        const line = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = `${labelText}: `;
        const detail = document.createElement('span');
        detail.textContent = value;
        line.append(label, detail);
        root.append(line);
      };
      const manualRetry = '다시 점검하려면 「현재 API 연결 점검」 버튼을 직접 누르세요. 자동으로 다시 점검하지 않습니다.';
      const notExplained = '이 점검은 모델 응답만 확인했습니다. 사건 설명은 아직 실행하지 않았습니다. 사건 설명은 보안 기록에서 사건을 선택해 별도로 요청하고 결과를 확인하세요.';

      if (mode === 'demo') addMessage('예제 응답(demo)이며 실제 AI 게이트 연결 결과가 아닙니다.', 'status', 'muted');

      if (status === 'idle') {
        addMessage('AI 연결 점검 전: 아직 점검하지 않았습니다. 이전 점검 결과는 표시하지 않습니다.', 'status', 'state state-empty');
        addMessage('계정 연결과 AI 연결 승인을 마친 뒤 「현재 API 연결 점검」 버튼을 직접 누르세요.', null, 'muted');
      } else if (status === 'loading') {
        addMessage('AI 연결 점검 중: 현재 로그인으로 모델 응답을 확인하고 있습니다…', 'status', 'state state-loading');
        addMessage('점검을 멈추려면 「취소」를 누르세요. 취소 뒤 늦게 도착한 응답은 표시하지 않습니다.', null, 'muted');
      } else if (status === 'ok') {
        const valid = data && typeof data === 'object' && data.transportChecked === true
          && ['test', 'verified'].includes(data.audienceAuthorization)
          && Number.isInteger(data.modelCount) && data.modelCount >= 0;
        if (!valid) {
          addMessage('확인 불가: 점검 응답 형식을 확인할 수 없습니다. 연결 성공으로 간주하지 마세요.', 'alert', 'state state-error');
          addMessage(manualRetry, null, 'muted');
        } else {
          const authLabels = {
            test: '시험 연결 점검(test) · 시험 transport의 모델 응답만 확인했으며 앱 권한 확인(verified)이 아닙니다.',
            verified: '앱 권한 확인 후 점검(verified) · 점검 시각 기준으로 앱 권한 확인과 모델 응답을 확인했습니다.',
          };
          addMessage(`AI 연결 점검 완료 — ${authLabels[data.audienceAuthorization]}`, 'status', 'state state-ok');
          addLine('권한 확인 구분(audienceAuthorization)', data.audienceAuthorization);
          addLine('응답 모델 수(modelCount)', String(data.modelCount));
          addLine('점검 시각(checkedAt)', safeText(checkedAt));
          if (data.modelCount === 0) {
            addMessage('응답한 모델이 0개입니다. 현재 사용할 수 있는 모델이 없으니 담당자에게 모델 허용 설정 확인을 요청하세요.', 'status', 'state state-error');
          }
          // explanationAccepted 는 공식 입력 계약상 항상 false 다. 모델 목록 응답을 사건 설명 성공으로 쓰지 않는다.
          addMessage(notExplained, null, 'muted');
          if (explanationAccepted !== false) {
            addMessage('확인 불가: 연결 점검 입력에 사건 설명 수락 값이 들어왔습니다. 사건 설명 성공으로 표시하지 않습니다.', 'status', 'state state-error');
          }
        }
      } else if (status === 'error') {
        const code = safeText(error?.code, 'AI_REQUEST_UNVERIFIED');
        const message = safeText(error?.message, 'AI 연결 또는 응답을 확인할 수 없습니다.');
        const groups = [
          {
            codes: ['ON_AI_PROVISIONING_PENDING', 'AI_REQUEST_UNVERIFIED', 'ON_AI_AUTHORIZATION_CHANGED', 'SUBJECT_SCOPE_UNVERIFIED'],
            title: '권한 준비 중·확인 불가',
            guide: '운영 측의 계정·앱 권한 준비 상태 문제일 수 있으며 학생 코드 오류로 단정하지 않습니다. 연결 성공이 아닙니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.',
          },
          {
            codes: ['WB_CLCO_AUTH_REQUIRED', 'WB_CLCO_ACCESS_BLOCKED', 'UNAUTHORIZED', 'FORBIDDEN'],
            title: '인증 실패·접근 제한',
            guide: '보호 현황의 계정 연결과 AI 연결 승인을 다시 확인하고, 계속되면 담당자에게 확인하세요. Workbench 열쇠나 원본 API 키를 복사해 붙이지 마세요.',
          },
          {
            codes: ['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'],
            title: '사용량·이용 한도 도달',
            guide: '반의 AI 사용량 또는 이용 한도 문제입니다. 담당자에게 확인하세요.',
          },
          {
            codes: ['WB_CLCO_SESSION_CLOSED'],
            title: '이용 시간 아님',
            guide: '현재는 AI 이용 시간이 아닙니다. 이용 시간을 확인한 뒤 직접 다시 점검하세요.',
          },
          {
            codes: ['WB_CLCO_RATE_LIMITED'],
            title: '요청 제한',
            guide: '요청이 잠시 제한됐습니다. 잠시 뒤 「현재 API 연결 점검」 버튼을 직접 눌러 다시 점검하세요.',
          },
          {
            codes: ['WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT'],
            title: '시간 초과',
            guide: '응답 시간이 초과됐습니다. 잠시 뒤 「현재 API 연결 점검」 버튼을 직접 눌러 다시 점검하세요.',
          },
          {
            codes: ['NETWORK_ERROR', 'NETWORK_UNAVAILABLE'],
            title: '네트워크 오류',
            guide: '서버에 연결하지 못했습니다. 네트워크를 확인하고 잠시 뒤 직접 다시 점검하세요.',
          },
          {
            codes: ['WB_CLCO_CANCELLED', 'CANCELLED', 'REQUEST_CANCELLED'],
            title: '점검 취소됨',
            guide: '점검을 취소했습니다. 이전 점검 결과는 현재 결과가 아닙니다. 필요하면 직접 다시 점검하세요.',
          },
          {
            codes: ['ON_AI_MODEL_LIST_EMPTY', 'MODEL_NOT_CONFIGURED'],
            title: '사용 가능한 모델 없음',
            guide: '현재 앱 권한으로 사용할 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정 확인을 요청하세요.',
          },
          {
            codes: ['ON_AI_INVALID_OUTPUT', 'ON_AI_INVALID_INPUT'],
            title: '응답 형식 확인 불가',
            guide: '점검 응답을 확인할 수 없습니다. 연결 성공으로 간주하지 말고, 계속되면 담당자에게 확인하세요.',
          },
        ];
        const group = groups.find((item) => item.codes.includes(code))
          || { title: '확인 불가', guide: '원인을 확인할 수 없습니다. 연결 성공으로 간주하지 말고 담당자에게 확인하세요.' };
        root.setAttribute('data-student-ai-error', code);
        addMessage(`AI 연결 점검 실패 — ${group.title}`, 'alert', 'state state-error');
        addLine('오류 코드', code);
        addLine('안내 메시지', message);
        addMessage(group.guide);
        addMessage(manualRetry, null, 'muted');
        addMessage('사건 설명은 실행되지 않았습니다.', null, 'muted');
      } else {
        addMessage('AI 연결 상태를 확인할 수 없습니다. 연결 성공으로 간주하지 마세요.', 'alert', 'state state-error');
        addMessage(manualRetry, null, 'muted');
      }
      return root;
    },
    // 18단계: 선택한 사건의 AI 설명을 그 사건의 근거·규칙·현재 상태와 연결해 표시한다.
    // 매 호출마다 새 요소를 만들어 반환하므로, 다른 기록 선택·다시 불러오기·실패 시 이전 설명과
    // 성공 속성(data-student-explanation-event)은 남지 않는다. 실행 버튼은 만들지 않는다.
    renderExplanation({ event = null, explanation, checkedAt = null } = {}) {
      const root = document.createElement('section');
      root.className = 'student-explanation';

      const heading = document.createElement('h3');
      heading.textContent = 'AI 사건 설명';
      root.append(heading);

      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || value.trim().length === 0) return fallback;
        return value.slice(0, 2000)
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
          .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, '[비밀값 제거]')
          .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[비밀값 제거]')
          .replace(/\b(?:github_pat_|gh[pousr]_|sk-(?:proj-|ant-|svcacct-)?)[A-Za-z0-9_-]{8,}\b/gi, '[비밀값 제거]')
          .replace(/\b(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*[^\s,;]+/gi, '[비밀값 제거]')
          .trim() || fallback;
      };
      const isId = (value) => typeof value === 'string' && value.length > 0;
      const addMessage = (parent, message, role = 'status', className = '') => {
        const line = document.createElement('p');
        if (role) line.setAttribute('role', role);
        if (className) line.className = className;
        line.textContent = message;
        parent.append(line);
        return line;
      };
      const addLine = (parent, labelText, value) => {
        const line = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = `${labelText}: `;
        const detail = document.createElement('span');
        detail.textContent = value;
        line.append(label, detail);
        parent.append(line);
      };
      const addSection = (titleText) => {
        const section = document.createElement('section');
        const title = document.createElement('h4');
        title.textContent = titleText;
        section.append(title);
        root.append(section);
        return section;
      };
      const addList = (parent, rows) => {
        const list = document.createElement('ul');
        for (const text of rows) {
          const item = document.createElement('li');
          item.textContent = text;
          list.append(item);
        }
        parent.append(list);
        return list;
      };
      const keepRecordNote = '보안 기록은 그대로입니다. AI 설명 실패는 업무 앱 판정이나 기록 목록에 영향을 주지 않으며 과제 실패가 아닙니다.';

      const status = explanation?.status;
      const eventId = isId(event?.id) ? event.id : null;
      if (explanation?.mode === 'demo') addMessage(root, '예제 응답(demo)이며 실제 AI 설명 결과가 아닙니다.', 'status', 'muted');

      // 1) 오류는 event 가 없어도 먼저 표시한다.
      if (status === 'error') {
        if (eventId) addLine(root, '사건 ID', eventId);
        const code = safeText(explanation?.error?.code, 'AI_REQUEST_UNVERIFIED');
        const message = safeText(explanation?.error?.message, 'AI 연결 또는 응답을 확인할 수 없습니다.');
        const reasons = {
          ON_AI_INVALID_OUTPUT: '근거 부족·근거 불일치: AI 설명의 근거 ID·조치·응답 형식이 이 기록과 맞지 않아 쓸 수 없습니다.',
          ON_AI_INVALID_INPUT: '근거 부족: 설명에 필요한 사건 근거·규칙을 확인할 수 없습니다.',
          SUBJECT_SCOPE_UNVERIFIED: '현재 로그인과 이 사건의 연결을 확인할 수 없습니다.',
          CANCELLED: '설명 요청을 취소했습니다. 이전 설명은 현재 결과가 아닙니다.',
          REQUEST_CANCELLED: '설명 요청을 취소했습니다. 이전 설명은 현재 결과가 아닙니다.',
          WB_CLCO_CANCELLED: '설명 요청을 취소했습니다. 이전 설명은 현재 결과가 아닙니다.',
        };
        addMessage(root, `AI 설명 실패: ${message}`, 'alert', 'state state-error');
        addLine(root, '오류 코드', code);
        if (reasons[code]) addMessage(root, reasons[code]);
        addMessage(root, keepRecordNote, null, 'muted');
        addMessage(root, '다시 요청하려면 해당 기록의 설명 요청 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.', null, 'muted');
        return root;
      }

      // 2) 오류 없이 기록이 선택되지 않은 경우.
      if (!eventId) {
        addMessage(root, '보안 기록에서 기록을 먼저 고르세요. 기록을 고른 뒤 설명을 요청할 수 있습니다.', 'status', 'state state-empty');
        return root;
      }

      if (!status || status === 'idle') {
        addLine(root, '사건 ID', eventId);
        addMessage(root, '설명 요청 전입니다. 이 기록의 설명 요청 버튼을 직접 누르세요.', 'status', 'state state-empty');
        return root;
      }
      if (status === 'loading') {
        addLine(root, '사건 ID', eventId);
        addMessage(root, 'AI 설명 요청 중… 다른 기록을 고르면 이 요청의 늦은 응답은 표시하지 않습니다.', 'status', 'state state-loading');
        return root;
      }
      if (status !== 'ok') {
        addLine(root, '사건 ID', eventId);
        addMessage(root, 'AI 설명 상태를 확인할 수 없습니다. 설명이 완료된 것으로 간주하지 마세요.', 'alert', 'state state-error');
        addMessage(root, keepRecordNote, null, 'muted');
        return root;
      }

      // 3) 성공 응답도 이 기록의 근거와 다시 대조한다. 맞지 않으면 성공 속성 없이 쓸 수 없다고 표시한다.
      const data = explanation?.data;
      const evidence = Array.isArray(event.evidence) ? event.evidence.filter((row) => isId(row?.id)) : [];
      const rules = Array.isArray(event.rules) ? event.rules : [];
      const supportedActions = Array.isArray(event.supportedActions) ? event.supportedActions : [];
      const evidenceText = new Map(evidence.map((row) => [row.id, row.text]));
      const refsValid = (list) => Array.isArray(list) && list.length > 0
        && new Set(list).size === list.length && list.every((ref) => isId(ref) && evidenceText.has(ref));
      const proposals = Array.isArray(data?.proposals) ? data.proposals : null;

      const problems = [];
      if (!data || typeof data !== 'object' || typeof data.summary !== 'string' || data.summary.trim().length === 0) {
        problems.push('AI 요약이 없습니다.');
      }
      if (data?.executed !== false) {
        problems.push('AI가 이미 실행했다고 답했거나 실행 여부를 확인할 수 없습니다. 이 설명은 쓸 수 없습니다.');
      }
      if (data?.requiresHumanConfirmation !== true) {
        problems.push('사람 확인 필요 표시가 없어 이 설명을 쓸 수 없습니다.');
      }
      if (evidence.length === 0) {
        problems.push('근거 부족: 이 기록에 대조할 근거가 없습니다.');
      } else if (!refsValid(data?.evidenceIds)) {
        const missing = Array.isArray(data?.evidenceIds)
          ? data.evidenceIds.filter((ref) => !evidenceText.has(ref)).map((ref) => safeText(String(ref)))
          : [];
        problems.push(missing.length > 0
          ? `근거가 맞지 않음: 이 기록에 없는 근거 ID(${missing.join(', ')})를 인용했습니다. 다른 기록의 설명일 수 있습니다.`
          : '근거가 맞지 않음: 인용한 근거 ID를 이 기록의 근거와 대조할 수 없습니다.');
      } else if (data.evidenceIds.length !== evidence.length) {
        problems.push('근거 부족: 이 기록의 근거를 모두 인용하지 않았습니다.');
      }
      if (!proposals) {
        problems.push('조치 제안 목록을 확인할 수 없습니다.');
      } else if (!proposals.every((p) => p && isId(p.action) && supportedActions.includes(p.action)
        && refsValid(p.evidenceIds) && typeof p.reason === 'string' && p.reason.trim().length > 0)) {
        problems.push('근거가 맞지 않음: 이 기록이 지원하지 않는 조치이거나 근거가 맞지 않는 제안이 있습니다.');
      }

      if (problems.length > 0) {
        addLine(root, '사건 ID', eventId);
        addMessage(root, 'AI 설명을 쓸 수 없습니다. 내용을 지어내지 않고 표시하지 않습니다.', 'alert', 'state state-error');
        addList(root, problems);
        addMessage(root, keepRecordNote, null, 'muted');
        return root;
      }

      // 4) 성공: 이 기록과 대조를 통과한 설명에만 성공 속성을 붙인다.
      root.setAttribute('data-student-explanation-event', eventId);
      addLine(root, '사건 ID', eventId);
      if (checkedAt) addLine(root, '설명 확인 시각', safeText(checkedAt));

      const summarySection = addSection('AI 설명(참고용)');
      addMessage(summarySection, 'AI가 이 기록을 읽고 쓴 해석입니다. 사실 판단은 아래 근거 글과 연동 시스템이 알려 준 상태를 기준으로 하세요.', null, 'muted');
      addMessage(summarySection, safeText(data.summary), null);

      const evidenceSection = addSection('인용한 근거');
      addList(evidenceSection, data.evidenceIds.map((ref) => `${ref} — ${safeText(evidenceText.get(ref), '근거 글 확인 불가')}`));

      const ruleSection = addSection('규칙');
      if (rules.length === 0) addMessage(ruleSection, '표시할 규칙이 없습니다.', null, 'muted');
      else addList(ruleSection, rules.map((rule) => `${safeText(rule?.id)} — ${safeText(rule?.text, '규칙 글 확인 불가')}`));

      const stateSection = addSection('확인 불가 상태');
      const stateNames = { access: '접속', session: '세션', device: '기기' };
      const unknownRows = Object.keys(stateNames)
        .filter((key) => event.state?.[key] === 'unknown' || event.state?.[key] == null)
        .map((key) => `${stateNames[key]}: 확인 불가(unknown)`);
      if (unknownRows.length === 0) addMessage(stateSection, '없음', null);
      else {
        addList(stateSection, unknownRows);
        addMessage(stateSection, '확인 불가 상태는 정상이나 안전으로 간주하지 않습니다.', null, 'muted');
      }

      const proposalSection = addSection('조치 제안');
      if (proposals.length === 0) {
        addMessage(proposalSection, supportedActions.length === 0
          ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
          : 'AI가 이 기록에 대해 제안한 조치가 없습니다. 필요하면 근거를 보고 담당자와 판단하세요.', null);
      } else {
        addList(proposalSection, proposals.map((p) =>
          `${p.action} — ${safeText(p.reason)} (근거 ${p.evidenceIds.join(', ')}) · 사람 확인이 필요하며 실행되지 않았습니다`));
      }
      addMessage(root, 'AI 설명과 제안만으로는 어떤 보안 조치도 실행되지 않습니다.', null, 'muted');
      return root;
    },
    // 19단계: AI 제안 → 사람 확인 → 서버 전달(ACK) → 연동 시스템 효과 관측을 구분해 표시한다.
    // 학생 함수는 표시만 한다. 조치 버튼·POST 요청·확인 티켓을 만들거나 저장하지 않으며,
    // 매 호출마다 새 요소를 만들어 반환하므로 새 입력이 오면 이전 대상·요청·결과 표시는 남지 않는다.
    renderAction({ status = 'idle', event = null, actionId = null, target = null, receipt = null,
      observation = null, message = '', confirmationExpiresAt = null, error = null } = {}) {
      const root = document.createElement('section');
      root.className = 'student-action';

      const heading = document.createElement('h3');
      heading.textContent = '보안 조치 처리 상태';
      root.append(heading);

      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || value.trim().length === 0) return fallback;
        return value.slice(0, 500)
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
          .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, '[비밀값 제거]')
          .replace(/\bac-on-[A-Za-z0-9_-]{8,}/g, '[확인 값 제거]')
          .replace(/\b(?:github_pat_|gh[pousr]_|sk-(?:proj-|ant-|svcacct-)?)[A-Za-z0-9_-]{8,}\b/gi, '[비밀값 제거]')
          .replace(/\b(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*[^\s,;]+/gi, '[비밀값 제거]')
          .trim() || fallback;
      };
      const isId = (value) => typeof value === 'string' && value.length > 0;
      const addMessage = (text, role = 'status', className = '') => {
        const line = document.createElement('p');
        if (role) line.setAttribute('role', role);
        if (className) line.className = className;
        line.textContent = text;
        root.append(line);
      };
      const addLine = (labelText, value) => {
        const line = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = `${labelText}: `;
        const detail = document.createElement('span');
        detail.textContent = value;
        line.append(label, detail);
        root.append(line);
      };
      const retryResultOnly = '제공 화면의 「연동 시스템 결과만 재조회」를 직접 누르세요. 조치를 다시 집행하지 마세요.';

      // 1) 결과가 현재 사건·조치와 묶여 있는지 확인한다. 다른 사건·조치의 결과는 현재 결과로 쓰지 않는다.
      const eventId = isId(event?.id) ? event.id : null;
      const receiptMismatch = receipt && typeof receipt === 'object' && (
        (isId(receipt.eventId) && eventId && receipt.eventId !== eventId)
        || (isId(receipt.actionId) && isId(actionId) && receipt.actionId !== actionId));
      if (receiptMismatch) {
        addMessage('확인 불가: 받은 처리 결과가 현재 사건·조치와 맞지 않습니다. 이전 사건의 결과를 현재 결과로 표시하지 않습니다.', 'alert', 'state state-error');
        addMessage('현재 기록에서 조치를 다시 준비하거나 결과만 재조회하세요.', null, 'muted');
        return root;
      }

      // 2) 상태별 문장. 서버 접수(ACK)와 실제 효과를 구분한다.
      const effectConfirmed = status === 'succeeded' && observation?.effectApplied === true;
      const statusText = {
        idle: '아직 미실행(idle): 조치를 준비하거나 집행하지 않았습니다.',
        loading: '조치 준비 또는 결과 조회 중(loading) · 완료 아님. 아직 아무 효과도 확인되지 않았습니다.',
        prepared: '준비됨·미실행(prepared): 실제 대상과 확인 기한을 확인한 뒤, 사람이 제공 화면의 「대상과 조치를 확인했으며 집행합니다」를 직접 눌러야 서버에 전달됩니다.',
        executing: '서버에 전달 중(executing) · 완료 아님. 아직 처리 결과가 없습니다. 같은 집행 버튼을 다시 누르지 마세요.',
        pending: '서버 접수·처리 중(pending) · 완료 아님. 서버가 요청을 받았다는 응답(ACK)은 실제 효과가 아닙니다.',
        denied: '거절(denied): 연동 시스템이 이 조치를 허용하지 않았습니다. 효과는 적용되지 않았습니다.',
        failed: '실패(failed): 연동 시스템이 조치를 처리하지 못했습니다.',
        unknown: '결과 불명(unknown): 성공으로도, 효과 없음으로도 판단하지 마세요. 이미 전달된 조치일 수 있습니다.',
        expired: '확인 기한 지남(expired): 이번 준비로는 집행할 수 없습니다. 현재 기록에서 조치를 다시 준비하세요.',
        error: '요청 처리 안 됨(error): 조치 요청이 처리되지 않았습니다.',
      };
      let shownStatus = status;
      if (status === 'succeeded' && !effectConfirmed) shownStatus = 'unknown';

      if (status === 'succeeded' && effectConfirmed) {
        addMessage('효과 확인(succeeded): 연동 시스템이 조치 효과를 관측했습니다.', 'status', 'state state-ok');
      } else if (status === 'succeeded') {
        addMessage('결과 불명(unknown): succeeded 응답에 효과 관측(effectApplied: true)이 없어 성공으로 표시하지 않습니다.', 'alert', 'state state-error');
      } else if (Object.hasOwn(statusText, status)) {
        const isProblem = ['denied', 'failed', 'unknown', 'expired', 'error'].includes(status);
        addMessage(statusText[status], isProblem ? 'alert' : 'status', isProblem ? 'state state-error' : '');
      } else {
        shownStatus = 'unknown';
        addMessage(`결과 불명(unknown; 원래 값: ${safeText(String(status), 'unknown')}): 상태를 확인할 수 없습니다. 성공이나 효과 없음으로 판단하지 마세요.`, 'alert', 'state state-error');
      }
      addLine('상태 원래 값(status)', safeText(String(status), 'unknown'));

      // 3) 현재 사건·근거·조치·대상·요청 식별 값(받은 것만).
      if (eventId) addLine('사건 ID(event.id)', eventId);
      const evidenceIds = Array.isArray(event?.evidence) ? event.evidence.map((row) => row?.id).filter(isId) : [];
      if (evidenceIds.length > 0) addLine('근거 ID', evidenceIds.join(', '));
      if (isId(actionId)) addLine('조치(actionId)', actionId);
      if (target && typeof target === 'object') {
        if (isId(target.id)) addLine('실제 대상(target.id)', safeText(target.id));
        if (Number.isSafeInteger(target.generation)) addLine('대상 세대(target.generation)', String(target.generation));
      }
      if (status === 'prepared' && confirmationExpiresAt) addLine('사람 확인 기한(confirmationExpiresAt)', safeText(confirmationExpiresAt));
      if (receipt && typeof receipt === 'object') {
        if (isId(receipt.requestId)) addLine('요청 ID(receipt.requestId)', safeText(receipt.requestId));
        if (isId(receipt.receiptId)) addLine('영수증 ID(receipt.receiptId)', safeText(receipt.receiptId));
        if (Number.isSafeInteger(receipt.version)) addLine('버전(receipt.version)', String(receipt.version));
        // 중복 집행 방지: 같은 요청을 다시 보내면 서버는 새로 실행하지 않고 기존 결과를 돌려준다(replayed).
        if (receipt.replayed === true) {
          addMessage('같은 요청 ID에 대한 기존 처리 결과입니다(replayed). 조치가 한 번 더 실행된 것이 아닙니다.', null, 'muted');
        }
        if (receipt.superseded === true) {
          addMessage('이전 조회 결과는 최신 결과를 대신하지 않습니다(superseded). 결과만 다시 조회하세요.', null, 'muted');
        }
      }

      // 4) 효과 관측 정보. succeeded + effectApplied:true 일 때만 효과 확인으로 쓴다.
      if (effectConfirmed) {
        addLine('관측 시각(observation.observedAt)', safeText(observation.observedAt));
        addLine('효과 적용', 'effectApplied: true');
      } else if (observation && typeof observation === 'object') {
        addLine('관측 시각(observation.observedAt)', safeText(observation.observedAt));
        addLine('효과 적용', `effectApplied: ${observation.effectApplied === true ? 'true' : observation.effectApplied === false ? 'false' : '확인 불가'}`);
      }

      // 5) 상태별 다음 행동 안내. 학생 화면에는 버튼을 만들지 않는다.
      if (['executing', 'pending', 'unknown'].includes(shownStatus) || (status === 'succeeded' && !effectConfirmed)) {
        addMessage(`결과는 아직 확인되지 않았습니다. ${retryResultOnly}`, null, 'muted');
      }
      if (['executing', 'pending', 'prepared'].includes(shownStatus)) {
        addMessage('중복 집행 방지: 집행 버튼을 반복해서 누르지 마세요. 같은 요청은 한 번만 처리됩니다.', null, 'muted');
      }
      if (status === 'error' || status === 'expired' || status === 'denied' || status === 'failed') {
        const code = safeText(error?.code, '');
        if (code) addLine('오류 코드', code);
        const detail = safeText(error?.message, '') || safeText(message, '');
        if (detail) addLine('안내 메시지', detail);
      } else if (isId(message) && shownStatus === 'idle') {
        addMessage(safeText(message), null, 'muted');
      }
      if (shownStatus === 'idle') {
        addMessage('조치는 AI 제안만으로 실행되지 않습니다. 현재 기록의 supportedActions가 비어 있으면 조치 준비 버튼이 나오지 않는 것이 정상입니다.', null, 'muted');
      }
      addMessage('「조치 화면 취소」는 이미 서버에 전달된 조치의 효과를 되돌리지 않습니다. 조작은 제공 화면 버튼으로만 합니다.', null, 'muted');

      // 6) 현재 사건과 요청이 확인된 화면에만 식별 속성을 붙인다.
      if (eventId && isId(receipt?.requestId)) {
        root.setAttribute('data-student-action-event', eventId);
        root.setAttribute('data-student-action-request', receipt.requestId);
      }
      return root;
    },
  };
}
