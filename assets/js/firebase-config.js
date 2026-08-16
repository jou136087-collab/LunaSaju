/* =========================================================================
 * firebase-config.js — Firebase 콘솔에서 받은 값
 *
 * 이 파일이 비어 있으면 사이트는 백엔드 없이 그대로 동작한다.
 * (로그인 버튼이 나타나지 않고, 저장은 브라우저 안 localStorage 만 쓴다.)
 * 값이 채워져 있으면 로그인·클라우드 저장·방문 집계가 켜진다.
 *
 * 설정 절차는 SETUP.md 참고.
 *
 * ⚠️ apiKey 는 비밀번호가 아니다. 웹 클라이언트에 공개되는 것이 정상이며,
 *    실제 접근 통제는 firestore.rules 가 한다. 그래서 이 파일은 커밋해도 된다.
 *    다만 Firebase 콘솔에서 "승인된 도메인"을 반드시 좁혀 두어야 한다.
 * ========================================================================= */
window.LUNE_FIREBASE = {
  /* https://www.gstatic.com/firebasejs/<version>/ 에서 불러온다 */
  sdkVersion: '12.17.1',

  config: {
    apiKey: 'AIzaSyB7YRbsnPIJ6rBM4Yp_dWRtwi6gy749eDQ',
    authDomain: 'lune-saju.firebaseapp.com',
    projectId: 'lune-saju',
    storageBucket: 'lune-saju.firebasestorage.app',
    messagingSenderId: '464620805458',
    appId: '1:464620805458:web:3a450010beb3c1a00d2e8b',
  },

  /* 관리자 UID 목록.
   * 화면에서 관리 메뉴를 보여줄지 판단하는 용도일 뿐이고,
   * 실제 권한은 firestore.rules 의 adminUids() 가 정한다. 양쪽을 같이 맞출 것.
   *
   * 채우는 법: 사이트에서 한 번 구글 로그인 → 콘솔 Authentication → 사용자 → UID 복사
   *   https://console.firebase.google.com/project/lune-saju/authentication/users
   */
  adminUids: ['w5AgWJ2zjBesnENYhGrkHVevhxp1'],
};
