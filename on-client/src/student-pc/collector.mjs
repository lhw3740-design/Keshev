// 학생 작성 모듈(마지막 총공세 2~3일차): 이 PC의 상태를 "읽기만" 해서 보여 줄 값을 만든다.
// - 값을 바꾸거나 설정을 고치는 명령은 쓰지 않는다(읽기 전용 PowerShell 조회와 Node 내장 os/fs 만 사용).
// - 읽지 못한 항목은 예시 값으로 채우지 않고 status:'unavailable' 과 이유 코드로 남긴다.
// - 모든 측정값에 measuredAt(잰 시각)과 method(어떻게 쟀는지)를 붙인다.
// - MAC 주소, 사용자 이름, 이벤트 본문 같은 개인정보·원문은 돌려주지 않는다.
import os from 'node:os';
import {statfs} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {parse as parsePath} from 'node:path';

const POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const COMMAND_TIMEOUT_MS = 6000;
const CPU_SAMPLE_MS = 500;

const nowIso = () => new Date().toISOString();
const unavailable = (code, message, method) => ({status: 'unavailable', code, message, measuredAt: nowIso(), method});
const round1 = (n) => Math.round(n * 10) / 10;

function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('cancelled'), {code: 'REQUEST_CANCELLED'}));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('cancelled'), {code: 'REQUEST_CANCELLED'})); }, {once: true});
  });
}

// 읽기 전용 PowerShell 스크립트를 실행하고 JSON 한 개를 돌려받는다. 실패하면 null 이 아니라 오류 코드를 던진다.
function runPowerShellJson(script, signal) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return reject(Object.assign(new Error('not windows'), {code: 'NOT_WINDOWS'}));
    execFile(POWERSHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
      `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; ${script}`],
    {timeout: COMMAND_TIMEOUT_MS, windowsHide: true, maxBuffer: 256 * 1024, signal}, (error, stdout) => {
      if (error) {
        const code = error.name === 'AbortError' ? 'REQUEST_CANCELLED' : error.killed ? 'COMMAND_TIMEOUT' : 'COMMAND_FAILED';
        return reject(Object.assign(new Error(code), {code}));
      }
      try { resolve(JSON.parse(String(stdout).trim())); }
      catch { reject(Object.assign(new Error('parse'), {code: 'OUTPUT_UNREADABLE'})); }
    });
  });
}

const failure = (error, method) => {
  const messages = {
    NOT_WINDOWS: 'Windows 가 아닌 환경이라 이 항목을 읽지 않았습니다.',
    COMMAND_TIMEOUT: `조회가 ${COMMAND_TIMEOUT_MS / 1000}초 안에 끝나지 않았습니다.`,
    COMMAND_FAILED: '조회 명령이 실패했습니다. 권한이나 서비스 상태를 확인하세요.',
    OUTPUT_UNREADABLE: '조회 결과 형식을 읽을 수 없습니다.',
    REQUEST_CANCELLED: '조회가 취소됐습니다.',
  };
  const code = Object.hasOwn(messages, error?.code) ? error.code : 'COMMAND_FAILED';
  return unavailable(code, messages[code], method);
};

async function readCpu(signal) {
  const method = `Node os.cpus() 를 ${CPU_SAMPLE_MS}ms 간격으로 두 번 읽어 사용률 계산`;
  try {
    const total = (cpus) => cpus.reduce((acc, c) => {
      const t = c.times; acc.idle += t.idle; acc.all += t.user + t.nice + t.sys + t.idle + t.irq; return acc;
    }, {idle: 0, all: 0});
    const first = os.cpus();
    if (!Array.isArray(first) || first.length === 0) return unavailable('CPU_UNREADABLE', 'CPU 정보를 읽을 수 없습니다.', method);
    const a = total(first);
    await abortableDelay(CPU_SAMPLE_MS, signal);
    const b = total(os.cpus());
    const allDelta = b.all - a.all, idleDelta = b.idle - a.idle;
    if (!(allDelta > 0)) return unavailable('CPU_UNREADABLE', 'CPU 사용률을 계산할 수 없습니다.', method);
    return {status: 'ok', usagePercent: round1(Math.min(100, Math.max(0, (1 - idleDelta / allDelta) * 100))),
      logicalCores: first.length, model: String(first[0].model || '').trim().slice(0, 120) || '확인 불가', measuredAt: nowIso(), method};
  } catch (error) { return failure(error, method); }
}

function readMemory() {
  const method = 'Node os.totalmem()/os.freemem()';
  const totalBytes = os.totalmem(), freeBytes = os.freemem();
  if (!(totalBytes > 0) || !(freeBytes >= 0)) return unavailable('MEMORY_UNREADABLE', '메모리 정보를 읽을 수 없습니다.', method);
  const usedBytes = totalBytes - freeBytes;
  return {status: 'ok', totalBytes, usedBytes, freeBytes, usagePercent: round1(usedBytes / totalBytes * 100), measuredAt: nowIso(), method};
}

async function readDisk() {
  const drive = parsePath(process.cwd()).root || '/';
  const method = `Node fs.statfs('${drive}') — 앱을 실행한 드라이브`;
  try {
    const s = await statfs(drive);
    const totalBytes = s.blocks * s.bsize, freeBytes = s.bavail * s.bsize;
    if (!(totalBytes > 0)) return unavailable('DISK_UNREADABLE', '디스크 용량을 읽을 수 없습니다.', method);
    return {status: 'ok', drive, totalBytes, freeBytes, freePercent: round1(freeBytes / totalBytes * 100), measuredAt: nowIso(), method};
  } catch { return unavailable('DISK_UNREADABLE', '디스크 용량을 읽을 수 없습니다.', method); }
}

async function readNetwork(signal) {
  const method = 'Node os.networkInterfaces() + PowerShell Get-NetConnectionProfile(읽기 전용)';
  const adapters = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    const usable = (addresses || []).filter((a) => !a.internal);
    if (usable.length === 0) continue;
    adapters.push({name: name.slice(0, 80), ipv4: usable.some((a) => a.family === 'IPv4' || a.family === 4), ipv6: usable.some((a) => a.family === 'IPv6' || a.family === 6)});
  }
  let profiles = null, profileError = null;
  try {
    const raw = await runPowerShellJson("@(Get-NetConnectionProfile | ForEach-Object { [pscustomobject]@{ alias=[string]$_.InterfaceAlias; category=[string]$_.NetworkCategory; ipv4=[string]$_.IPv4Connectivity; ipv6=[string]$_.IPv6Connectivity } }) | ConvertTo-Json -Compress -Depth 3", signal);
    profiles = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((p) => ({
      alias: String(p.alias || '').slice(0, 80), category: String(p.category || ''), ipv4: String(p.ipv4 || ''), ipv6: String(p.ipv6 || '')}));
  } catch (error) { profileError = failure(error, method); }
  if (adapters.length === 0 && !profiles) return profileError || unavailable('NETWORK_UNREADABLE', '네트워크 구성을 읽을 수 없습니다.', method);
  return {status: 'ok', adapters, profiles, profileStatus: profiles ? 'ok' : 'unavailable', profileCode: profileError?.code ?? null, measuredAt: nowIso(), method};
}

async function readFirewall(signal) {
  const method = 'PowerShell Get-NetFirewallProfile(읽기 전용)';
  try {
    const raw = await runPowerShellJson("@(Get-NetFirewallProfile | ForEach-Object { [pscustomobject]@{ name=[string]$_.Name; enabled=[string]$_.Enabled } }) | ConvertTo-Json -Compress -Depth 3", signal);
    const profiles = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((p) => ({name: String(p.name || '확인 불가'), enabled: String(p.enabled || '')}));
    if (profiles.length === 0) return unavailable('FIREWALL_UNREADABLE', '방화벽 프로필을 읽을 수 없습니다.', method);
    return {status: 'ok', profiles, measuredAt: nowIso(), method};
  } catch (error) { return failure(error, method); }
}

async function readEvents(signal) {
  const hours = 24, cap = 2000;
  const method = `PowerShell Get-WinEvent(System·Application, 최근 ${hours}시간, 수준 오류·경고, 로그별 최대 ${cap}건 읽기 전용)`;
  const script = `$since=(Get-Date).AddHours(-${hours}); $out=@(); foreach($log in 'System','Application'){ try { $e=@(Get-WinEvent -FilterHashtable @{LogName=$log;Level=2,3;StartTime=$since} -MaxEvents ${cap} -ErrorAction Stop); $out+=[pscustomobject]@{ log=$log; ok=$true; errors=@($e | Where-Object { $_.Level -eq 2 }).Count; warnings=@($e | Where-Object { $_.Level -eq 3 }).Count; capped=($e.Count -ge ${cap}) } } catch { if ([string]$_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $out+=[pscustomobject]@{ log=$log; ok=$true; errors=0; warnings=0; capped=$false } } else { $out+=[pscustomobject]@{ log=$log; ok=$false } } } }; @($out) | ConvertTo-Json -Compress -Depth 3`;
  try {
    const raw = await runPowerShellJson(script, signal);
    const logs = (Array.isArray(raw) ? raw : [raw]).map((l) => l?.ok === true
      ? {log: String(l.log), status: 'ok', errors: Number(l.errors) || 0, warnings: Number(l.warnings) || 0, capped: l.capped === true}
      : {log: String(l?.log || '확인 불가'), status: 'unavailable', code: 'EVENTLOG_UNREADABLE'});
    return {status: 'ok', windowHours: hours, logs, measuredAt: nowIso(), method};
  } catch (error) { return failure(error, method); }
}

export async function collectPcStatus({signal} = {}) {
  const startedAt = nowIso();
  const [cpu, disk, network, firewall, events] = await Promise.all([
    readCpu(signal), readDisk(), readNetwork(signal), readFirewall(signal), readEvents(signal)]);
  const memory = readMemory();
  return {source: 'measured', platform: process.platform, hostKind: process.platform === 'win32' ? 'windows' : 'other',
    startedAt, finishedAt: nowIso(), items: {cpu, memory, disk, network, firewall, events}};
}
