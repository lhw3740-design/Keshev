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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
