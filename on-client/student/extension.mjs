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
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
