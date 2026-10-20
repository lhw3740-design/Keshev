// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
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
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
