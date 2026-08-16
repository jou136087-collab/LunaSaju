# 백엔드 연결 상태

**설정이 전부 끝났습니다.** 프로젝트 생성 · Firestore(서울) · 규칙 · 호스팅 · 구글 로그인 ·
관리자 등록까지 모두 적용되어 동작 중입니다.

| | |
|---|---|
| 라이브 | <https://lune-saju.web.app> |
| 콘솔 | <https://console.firebase.google.com/project/lune-saju> |
| 프로젝트 ID | `lune-saju` (번호 464620805458) |
| Firestore | `(default)` · **asia-northeast3 (서울)** |

---

## ✅ 끝난 것

- [x] Firebase 프로젝트 생성 (`lune-saju`)
- [x] 웹 앱 등록 · `assets/js/firebase-config.js` 에 설정값 기입
- [x] Cloud Firestore API 활성화
- [x] Firestore 데이터베이스 생성 — **asia-northeast3(서울)**
- [x] `firestore.rules` 배포 + **라이브 검증**
- [x] Firebase Hosting 배포 (22개 파일, `tools/`·`*.md`·`node_modules` 제외 확인)

### 라이브에서 확인한 규칙 동작

| 시도 | 결과 |
|---|---|
| 비로그인 사용자 명단 조회 | 차단 (403) |
| 비로그인 방문 수 읽기 | 차단 (403) |
| 비로그인 카운터 **+1** | 허용 ← 집계가 되려면 이래야 함 |
| 비로그인 카운터 **+500** | 차단 (403) |
| 비로그인 카운터 **−1** | 차단 (403) |
| 카운터 임의값 덮어쓰기 | 차단 (403) |

> 검증 과정에서 방문 카운터가 몇 회 올라가 있습니다.
> 0 부터 시작하고 싶으면 콘솔 → Firestore → `stats/global` 문서를 지우세요.
> (규칙상 클라이언트는 삭제할 수 없고, 콘솔은 규칙을 우회합니다.)

---

- [x] **구글 로그인 제공자 활성화** — `accounts:createAuthUri` 응답으로 확인
- [x] 승인된 도메인 — `localhost`, `lune-saju.web.app`, `lune-saju.firebaseapp.com`

- [x] **관리자 등록** — UID `w5AgWJ2zjBesnENYhGrkHVevhxp1`, 두 파일 일치 확인 후 배포
      (어느 계정인지는 콘솔 → Authentication → 사용자 에서 확인)

**설정이 전부 끝났습니다.** 아래는 앞으로 관리자를 바꾸거나 추가할 때 쓰는 방법입니다.

---

## 관리자 바꾸기 · 추가하기

```powershell
cd Desktop\dev\WEB_Project\260815_SajuLune
node tools/set-admin.mjs --show          # 현재 상태 보기
node tools/set-admin.mjs 이메일@주소      # 그 계정을 관리자로
firebase deploy
```

`tools/set-admin.mjs` 는 `firebase auth:export` 로 UID 를 가져와
`firebase-config.js` 의 `adminUids` 와 `firestore.rules` 의 `adminUids()` 를 **동시에** 고칩니다.

> 손으로 고칠 때 가장 흔한 실수가 **한쪽만 고치는 것**입니다.
> 화면 쪽만 고치면 메뉴는 보이는데 서버가 데이터를 주지 않습니다.
> `firestore.rules` 가 실제 권한이고, 고친 뒤에는 반드시 배포해야 적용됩니다.

여러 명을 관리자로 두려면 두 파일의 배열에 UID 를 나란히 적으면 됩니다.

```js
adminUids: ['UID1', 'UID2'],          // firebase-config.js
```
```
return ['UID1', 'UID2'];              // firestore.rules
```

---

## 확인 체크리스트

- [ ] 로그인 전: 사이드바 아래에 **구글로 로그인** 버튼이 보인다 *(이미 보입니다)*
- [ ] 로그인 후: 프로필 사진과 이름이 뜬다
- [ ] 명식을 세우고 "이 브라우저에 기억해 두기"를 켠 뒤, **다른 브라우저에서 로그인**하면 값이 따라온다
- [ ] 관리자 계정으로 로그인하면 사이드바에 **방문 현황** 메뉴가 생긴다
- [ ] 관리자가 아닌 계정으로 `admin.html` 을 열면 막힌다

---

## 자주 쓰는 명령

```powershell
firebase deploy                       # 전체 배포
firebase deploy --only hosting        # 화면만
firebase deploy --only firestore:rules # 규칙만
firebase hosting:disable              # 사이트 비공개로 내리기
npm test                              # 계산·명암비 검증 (설치 불필요)
npm run test:rules                    # 보안 규칙 26가지 시나리오 (에뮬레이터)
```

**규칙을 고쳤다면 배포 전에 반드시 `npm run test:rules`.**
통과 로그에 `evaluation error` 가 섞여 나오는 것은 정상입니다. Firestore 가 해당 요청에
적용되지 않는 규칙 가지까지 평가해 보고 남기는 흔적이며, **거부된 요청에서만** 나타납니다.

---

## 알아둘 것

**비용** — 무료 한도(Spark)는 Firestore 읽기 5만/일, 쓰기 2만/일입니다.
이 사이트의 쓰기는 방문 1회당 2~3건이라 하루 수천 명까지 여유가 있습니다.

**비로그인 방문 집계의 한계** — 카운터는 로그인하지 않은 사람도 올릴 수 있어야 집계가 됩니다.
규칙에서 *정확히 +1* 만 허용하고 브라우저 세션당 1회로 묶었지만, 작정하고 반복 호출하면
숫자를 부풀리거나 무료 한도를 소모시킬 수 있습니다. 트래픽이 붙으면
**App Check(reCAPTCHA v3)** 를 켜서 막는 것을 권합니다.
정확한 숫자보다 안전이 중요하다면 `auth.js` 의 `logVisit()` 에서 비로그인 분기를 지우고
로그인 방문만 세도 됩니다.

**계정 삭제 요청** — 개인정보처리방침에 "요청 시 파기"라고 적어 두었습니다.
콘솔 Authentication 에서 사용자를 지우고, Firestore `users/{uid}` 문서도 함께 지우세요.

**개인정보처리방침 문의처** — `legal.html` 에 `wooyoung1574@naver.com` 으로 적혀 있습니다.
공개 페이지에 실린 주소라 스팸이 올 수 있습니다. 부담스러우면 이 용도의 별도 주소로 바꾸세요.
다만 문의 창구 자체를 비워 둘 수는 없습니다.

**사이트를 내리려면** — `firebase hosting:disable` 한 줄이면 즉시 비공개가 됩니다.
