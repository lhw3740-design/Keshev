# 케셰브 (Keshev) — BYTE BACK 4차 보안 Agent

이 저장소는 ALEPH BYTE BACK 방어전 13~22단계에서 만드는 보안 Agent 앱 **케셰브**의 프로젝트 폴더입니다. 앱은 `on-client/` 폴더 안에 있고, Git 저장소의 최상위는 이 폴더(프로젝트 폴더)입니다.

> 이 README와 `on-client/docs/STUDENT_RUNBOOK.md`는 학생이 작성한 문서입니다. `on-client/README.md`와 `on-client/docs/`의 나머지 문서는 시작 틀에서 제공된 문서이며 수정하지 않았습니다.

## 목적

회사 직원이 자기 계정·기기·세션 상태, 업무 앱 접근 판정, 자기 접속 기록과 XDR 경보를 확인하는 보안 앱입니다. 17단계부터는 앱 안에서 수업용 AI 게이트를 통해 사건 설명을 받고(참고용), 조치 처리 상태와 사용 라이브러리의 알려진 취약점(OSV)을 대조해 보여 줍니다.

## 기능

| 화면 영역 | 하는 일 | 학생 구현 함수 |
|---|---|---|
| 내 계정·기기·세션 | 현재 로그인·기기·세션 상태 표시 | `renderIdentity` (13단계) |
| 업무 앱 접근 판정 | 선택한 업무 앱의 allow/deny/challenge/unknown 판정 표시 | `renderDecision` (14단계) |
| 내 접속 기록·XDR 경보 | 기록 필터·상세(근거·규칙·상태) 표시 | `renderEvents` (15단계) |
| 기기·세션·알림·도움정보 | 상태 묶음, 비밀값을 걸러 낸 도움정보 복사 | `renderStatus` (16단계) |
| 앱 내부 AI 연결 | 연결 점검 결과(test/verified)와 오류 원인별 안내 | `renderAiConnection` (17단계) |
| AI 사건 설명 | 설명을 그 기록의 근거·규칙·확인 불가 상태와 대조해 표시 | `renderExplanation` (18단계) |
| 조치 처리 상태 | 제안 → 사람 확인 → 서버 전달(ACK) → 효과 관측 구분 | `renderAction` (19단계) |
| 사용 라이브러리 취약점 | lock 파일 기준 설치 버전과 OSV 결과, 미조회·일부 실패 구분 | `renderVulnerabilities` (20단계) |
| 내 PC 상태 (마지막 총공세) | CPU·메모리·디스크 실측, 네트워크·방화벽·Windows 기록 건수 읽기 전용, 잰 시각·방법, 확인 불가 구분 | `renderStatus` 칸의 `createPcPanel` + 서버 학생 모듈 `src/student-pc/collector.mjs` |

모든 학생 함수는 `on-client/student/extension.mjs` 한 파일에 있습니다.

## 구성 (요약)

```text
브라우저(127.0.0.1:5189)
  └─ on-client/public/index.html + app.js (제공 화면)
       └─ student/extension.mjs (학생 표시 함수)
  ↓ HTTP /api/*
로컬 앱 서버 on-client/src/server.mjs (Node.js)
  ├─ 접근 제어·XDR 엔진: student/engine-adapter.mjs → SDP 호스트(운영자 설정 시) / 기본은 disconnected, -Demo 는 예제
  ├─ AI 게이트(CLCO): src/ai/*  → https://ai-classroom-gateway-production.up.railway.app
  ├─ 계정 연결 승인: src/connection/* → https://aleph-omega.vercel.app (ALEPH 포털)
  ├─ 조치 처리: src/actions/*
  └─ 취약점 조회: src/vulnerabilities/* → https://api.osv.dev/v1/querybatch (허용 목록이 있을 때만)
```

자세한 구성도(Mermaid·표)와 실행·종료·재실행, 오류별 확인 순서는 [on-client/docs/STUDENT_RUNBOOK.md](on-client/docs/STUDENT_RUNBOOK.md)에, 새 폴더 재현 기록·단계별 결과·데이터 보존 계획·지원 범위는 [on-client/docs/REPRODUCTION_LOG.md](on-client/docs/REPRODUCTION_LOG.md)에 있습니다.

버전 상태: **검증 중인 버전** (실제 SDP·AI·조치 집행 연결 미완료, v1.0 아님).

## 지원 환경과 버전

| 항목 | 값 | 근거 |
|---|---|---|
| 운영체제 | Windows + PowerShell | 실행 도구 `on-client/tools/start-alekov.ps1` |
| Node.js | 22~24, 검수 기준 24.19.0 (내 PC: v24.22.0) | `on-client/package.json` 의 `engines.node`, 실행 도구의 버전 검사 |
| 외부 npm 의존성 | 없음 (`package.json`에 dependencies 없음, lock 파일 없음) | `on-client/package.json` |
| 시작 틀 | `alekov-client-starter` 0.2.14 의 제공 파일 + 학생 파일 | `on-client/package.json` 의 `name`·`version` |
| 기본 주소 | `http://127.0.0.1:5189/` (`ON_PORT`, 실행 도구 `-Port`) | `on-client/.env.example`, 실행 도구 |

내 PC에서 실제로 확인한 것: 워크벤치 프로젝트에서 `tools\start-alekov.ps1`로 앱을 켜서 화면을 열어 봤습니다. 내 PC의 Node.js 는 `node -v` 결과 **v24.22.0** 입니다. 실행 도구가 허용하는 22~24 범위 안이며, 수업 기준(v24.19.0)과 달라 실행 도구가 `참고: 지금 Node.js 는 v24.22.0 입니다. 수업 기준은 v24.19.0 입니다.` 안내를 함께 출력합니다(실행은 계속됨).

## 빠른 실행

처음 보는 사람용 한 장 안내: [on-client/docs/QUICKSTART.md](on-client/docs/QUICKSTART.md) · 시연 순서와 한계: [on-client/docs/FINAL_SHOWCASE.md](on-client/docs/FINAL_SHOWCASE.md)

`on-client` 폴더에서 PowerShell을 열고:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1
```

`케셰브가 켜졌습니다. 브라우저에서 http://127.0.0.1:5189/ 을 여세요.` 가 보이면 브라우저로 그 주소를 엽니다. 종료는 같은 창에서 `Ctrl+C` 입니다.

## 제공 부분과 학생 작성 부분

| 구분 | 파일 |
|---|---|
| 학생 작성 | `on-client/student/extension.mjs`, `on-client/src/student-pc/collector.mjs`, `README.md`(이 파일), `on-client/docs/STUDENT_RUNBOOK.md`, `on-client/docs/REPRODUCTION_LOG.md`, `on-client/docs/QUICKSTART.md`, `on-client/docs/FINAL_SHOWCASE.md`, `.gitignore` |
| 제공 파일에 학생이 추가 | `on-client/src/server.mjs` — `// [학생 추가]` 로 표시한 import 1줄과 `GET /api/student/pc-status` 경로 1개만 추가 |
| 제공(수정하지 않음) | `on-client/public/*`, `on-client/src/**`(위 server.mjs 추가분·student-pc 제외), `on-client/tools/*`, `on-client/vendor/*`, `on-client/student/engine-adapter.mjs`, `on-client/package.json`, `on-client/.env.example`, `on-client/README.md`, `on-client/docs/*`(학생 작성 문서 4개 제외) |

참고: `on-client/public/app.js`는 13단계에 받은 시작 틀 판본 그대로이며, 0.2.14 판본과 AI 요청 제한 시간 처리(이 판본은 모든 요청 10초)와 `WB_CLCO_ACCESS_BLOCKED` 안내 문구가 다릅니다. 나머지 제공 파일은 0.2.14 시작 틀에서 그대로 가져왔습니다.

## 비밀값

키·토큰·비밀번호·인증서는 이 저장소와 문서에 넣지 않습니다. `on-client/.env.example`은 비밀 없는 설정 예시(환경변수 이름)입니다. 서버(`src/server.mjs`)는 `.env` 파일을 자동으로 읽지 않고 실행 시점의 환경변수(`ON_PORT`, `ON_ENGINE_ADAPTER`, `ON_PROJECT_DIRECTORY`, `ON_APPROVED_PUBLIC_PACKAGES` 등)를 읽습니다. 계정 연결용 설정과 자격 보관소는 실행 도구가 프로젝트 밖의 Windows 사용자 폴더에 둡니다. 혹시 만든 `.env`는 `.gitignore`로 커밋에서 제외합니다.
