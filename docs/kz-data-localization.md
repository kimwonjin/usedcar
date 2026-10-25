# 카자흐스탄 개인정보 국내 저장 요건 검토 (2026-10-25)

> 웹 공개 자료 기반 1차 검토입니다. 법률 자문이 아니며, 출시 전 현지 변호사 확인이 필요합니다.

## 결론
- **현행법상 카자흐스탄 국민의 개인정보는 카자흐스탄 영토 안의 서버에 저장해야 한다.**
  근거: 「개인정보 및 그 보호에 관한 법률」(№ 94-V, 2013.5.21) 제12조. 2015년 개정으로 도입, 여러 차례 개정에도 유지,
  2020년 부처 명령으로 강화(AmCham Kazakhstan, 2026.5 브리프).
- 적용 대상: 카자흐스탄 법인·개인사업자·외국 법인 지사. 현지 사용자를 대상으로 하는 해외 서비스에도 적용된다는 해석이 있다.
- "카자흐스탄 업체를 쓴다"와 "서버가 카자흐스탄에 있다"는 다르다. **DB와 복사본(백업)의 실제 물리적 위치**를 알아야 한다.
- 국외 이전(제16조): 적정 보호 수준 국가로는 동의 없이 가능, 그 외는 정보주체의 별도 동의 등이 필요. 단, 국외 이전이 허용돼도 **국내 저장 의무는 별개**로 본다.
- 동향: 2026년 1월 디지털법전·2025년 11월 AI법이 현지화 기조를 강화. 반면 **대부분의 개인정보에 대해 국내 저장 의무를 완화하는 정부령 초안**이 논의 중(채택 여부 미확인).
- 위반 시 행정·형사 책임 규정이 있다(구체 금액·요건은 조문 확인 필요). 해외 서비스가 일시 차단된 사례도 있다(2023년 Yandex).

## 이 서비스에 미치는 영향
| 데이터 | 현재 위치 | 판단 |
| --- | --- | --- |
| 회원 전화번호·이름, 딜러 사업자 정보, 채팅, 거래 기록 | Supabase (해외 리전) | **국내 저장 대상 가능성 높음** |
| 차량 사진·매장 사진·감가 사진 | Supabase Storage (해외) | 번호판·얼굴 등 포함 시 개인정보 |
| 웹 화면(코드) | Vercel (해외) | 개인정보를 저장하지 않으면 영향 적음 |

## 선택지
1. **출시 전 현지 서버로 이전 (권장)**: 카자흐스탄 데이터센터에 Supabase를 직접 설치(오픈소스, Docker)하거나
   관리형 PostgreSQL + 파일 저장소를 사용. 후보: PS Cloud Services(ps.kz, 알마티·아스타나, 관리형 PostgreSQL),
   Servercore(알마티, 관리형 PostgreSQL), Kazteleport 기반 VPS 등. 앱 코드는 Supabase 접속 주소만 바꾸면 된다.
2. **하이브리드**: 개인정보(전화번호·이름·채팅·딜러 정보)만 국내 DB에 두고 나머지는 해외 유지 — 구조가 복잡해져 비권장.
3. **완화 정부령 채택 대기**: 채택 시 국외 저장이 가능해질 수 있으나 일정 불확실.

## 다음 할 일
- [ ] 현지 변호사에게 제12조 적용 범위(차량 사진·번호판 포함 여부, 비거주 법인 적용 여부)와 완화령 진행 상황 확인
- [ ] 현지 호스팅 2~3곳 견적·사양 비교(관리형 PostgreSQL, 백업 위치, 객체 저장소 제공 여부)
- [ ] 이전 시점 결정(실사용자 데이터를 받기 전, 즉 문자 인증 전환과 같은 시기가 적당)

## 출처
- AmCham Kazakhstan, Data Localization Issue Brief (2026.5): https://amcham.kz/wp-content/uploads/2026/05/2026-05-15_AmCham_DataLocalization_Issue-Brief_ENG_v5.pdf
- GSE, Personal data storage in Kazakhstan: https://gse.kz/en/blog/personal-data-storage-kazakhstan
- Astana Hub, 데이터 현지화 가이드: https://astanahub.com/en/blog/lokalizatsiia-dannykh-v-kazakhstane-chto-nuzhno-znat-it-kompanii
- Astana Hub, e-commerce·스타트업 개인정보: https://astanahub.com/en/blog/data-protection-dlia-e-commerce-i-tech-startapov
- Morgan Lewis, Data Localization Laws Overview: Kazakhstan: https://www.morganlewis.com/pubs/2019/05/data-localization-laws-overview-kazakhstan-practical-law-data-privacy-advisor
- EUI Digital Trade Integration DB: https://dti.eui.eu/database/page/430/
- U.S. Commercial Service, Kazakhstan Digital Economy: https://www.trade.gov/country-commercial-guides/kazakhstan-digital-economy
- Meduza, Yandex 서버 이전 (2023): https://meduza.io/en/news/2023/08/21/yandex-agrees-to-relocate-kazakhstan-branch-servers-after-astana-briefly-blocks-site
- ps.kz 요금·사양(WHTop): https://www.whtop.com/plans/ps.kz/114162 · Servercore PostgreSQL: https://servercore.com/services/cloud-databases/cloud-databases-postgresql/
- 원문 확인처: adilet.zan.kz (카자흐스탄 법령 DB)
