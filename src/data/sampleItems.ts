import { ListeningItem } from '../types/assessment';

export const DEFAULT_OPERATION_GUIDE = {
  method:
    '약 50초~1분 분량의 독립된 담화 및 대화 음성 파일을 들려준다. 정기시험의 서답형(서술형) 및 선택형 문항 운영을 목표로 개발되었으며, 음원을 1회 재생 후 적절한 답안을 작성한다. 학생들의 정보 재구성 및 노트테이킹 시간을 고려하여 1회 재생한 뒤 50초~1분간 답안을 작성하도록 운영한다.',
  benefits:
    '1지문 1문항의 ‘듣기 기능 중심형’ 설계로, 세부 정보 파악·요지 파악·의도 추론·인과관계 추론 등 목표 성취기준이 요구하는 핵심 듣기 기능의 도달 여부를 문항 간 간섭 없이 정확하게 진단할 수 있다.',
  cautions:
    '서답형 문항 채점 시 단순 철자 오류나 문법적 사소한 오류로 인해 듣기 이해력 자체가 과소평가되지 않도록, 채점 기준표에 명시된 ‘핵심 의미 전달 여부’를 중심으로 채점하는 것을 고려한다.',
};

// 업로드해주신 「2026 중등 영어듣기 현장지원단 자료집 고등 유형별 서식」 4개 모델 예시 완벽 수록 (+ DELTA 확장 메타데이터 포함)
export const SAMPLE_ITEMS: ListeningItem[] = [
  {
    id: 'sample-1',
    itemNo: 1,
    mode: 'ib',
    questionFormat: 'gap_poster',
    includeOperationGuide: true,
    operationGuide: { ...DEFAULT_OPERATION_GUIDE },
    gradeSubject: '1학년 / 공통영어1',
    evalMethod: '정기시험 혹은 수행평가(서술형/서답형)',
    achievementStandard: '[10공영1-01-01] 말이나 글에 포함된 세부 정보를 파악한다.',
    directive: '파악',
    skill: '세부 정보 파악',
    topic: '학교생활',
    subtopic: '진로·진학',
    expressions: ['주의 끌기', '시간 말하기', '행동이나 방향 지시하기'],
    structures: ['Postmodification', 'Passive Voice', 'Subordinating Conjunctions'],
    vocabLevelId: 'high1_common',
    vocabLevelLabel: '고1 공통·기본영어 (1,600~1,800단어)',
    targetWordCount: 115,
    keyVocab: 'graduate, originally, venue, auditorium, register',
    difficulty: '중',
    taskDescription:
      '교내 진로 멘토링 특강 안내 방송을 듣고, 세부 정보(신청 방법, 변경된 장소 등)의 빈칸을 완성하는 서답형 1문항',
    materialType: '담화문(안내 방송)_학교생활/일상(학교행사)',
    source: '자체 제작(AI 생성)',
    transcript: `W: Good morning, students. This is your career counselor, Ms. Kim. I’d like to share some important details about next Friday’s Career Mentoring Day. Three graduates working in IT, media, and healthcare will visit our school to share their work experiences. Originally, the event was scheduled to take place in the library, but since so many students showed interest, we moved the venue to the school auditorium. If you want to join, please sign up through the school website by this Wednesday. Also, don’t forget to submit one question for the mentor on the online form when you register. Everyone who attends will receive a career guidebook for free. Thank you for listening!`,
    koreanTranslation:
      '여: 좋은 아침입니다, 학생 여러분. 진로 상담 교사 김 선생님입니다. 다음 주 금요일에 열리는 ‘진로 멘토링의 날’에 관한 중요한 세부 사항을 안내해 드리겠습니다. IT, 미디어, 보건의료 분야에서 일하고 있는 졸업생 세 분이 우리 학교를 방문하여 직무 경험을 나누어 줄 예정입니다. 원래 이 행사는 도서관에서 열릴 예정이었으나, 정말 많은 학생이 관심을 보여 장소를 학교 강당으로 변경했습니다. 참가를 원하는 학생은 이번 주 수요일까지 학교 웹사이트를 통해 신청해 주세요. 또한 등록하실 때 온라인 신청서에 멘토에게 할 질문 한 가지를 잊지 말고 제출해 주시기 바랍니다. 참석하는 모든 학생에게는 진로 가이드북을 무료로 드립니다. 들어주셔서 감사합니다!',
    questionPrompt:
      '다음 교내 안내 방송을 듣고, ‘Career Mentoring Day’ 안내 포스터의 빈칸 (1)~(3)에 들어갈 알맞은 말을 영어로 쓰시오. (각 빈칸당 1~2단어로 작성할 것)',
    stimulusTitle: '[2026 Career Mentoring Day Notice]',
    stimulusBody: `Date: Next Friday
Fields: IT, Media, and Healthcare
Place: Moved from the library to the (   1   )
How to Sign Up: Register on the (   2   ) by this Wednesday
Required Action: Write and submit (   3   ) for the mentor when registering`,
    options: ['', '', '', '', ''],
    isConstructedResponse: true,
    correctChoice: 1,
    modelAnswer: `(1) (school) auditorium\n(2) (school) website\n(3) one[a] question`,
    totalMarks: 3,
    rubricRows: [
      {
        id: 'r1-1',
        scoreLabel: '3점',
        criteria:
          '(1)~(3)의 핵심 정보를 모두 정확하게 영어로 작성한 경우 (관사 유무 및 대소문자 무관, 의미를 해치지 않는 경미한 철자 오류 허용)',
      },
      {
        id: 'r1-2',
        scoreLabel: '2점',
        criteria: '(1)~(3) 중 2개만 정확하게 작성한 경우',
      },
      {
        id: 'r1-3',
        scoreLabel: '1점',
        criteria: '(1)~(3) 중 1개만 정확하게 작성한 경우',
      },
      {
        id: 'r1-4',
        scoreLabel: '0점',
        criteria: '모두 부정확하거나 답안을 작성하지 않은 경우',
      },
    ],
    explanation:
      '담화 중반부의 “we moved the venue to the school auditorium”, “sign up through the school website by this Wednesday”, “submit one question for the mentor”에서 각각 (1) auditorium, (2) website, (3) one question을 파악할 수 있다.',
  },
  {
    id: 'sample-2',
    itemNo: 2,
    mode: 'ib',
    questionFormat: 'mcq_5',
    includeOperationGuide: false,
    operationGuide: { ...DEFAULT_OPERATION_GUIDE },
    gradeSubject: '1학년 / 공통영어2',
    evalMethod: '정기시험(선택형)',
    achievementStandard: '[10공영2-01-02] 말이나 글의 주제나 요지를 파악한다.',
    directive: '파악',
    skill: '주제·요지 파악',
    topic: '생태전환',
    subtopic: '생태전환 실천',
    expressions: ['의견 묻거나 표현하기', '제안·권유하기', '동의하기'],
    structures: ['Anticipatory It', 'Modals', 'Real Conditionals'],
    vocabLevelId: 'high1_common',
    vocabLevelLabel: '고1 공통·기본영어 (1,600~1,800단어)',
    targetWordCount: 135,
    keyVocab: 'overflowing, tumbler, introduce, reusable, convenience',
    difficulty: '중',
    taskDescription:
      '학교 매점의 일회용 컵 사용 문제를 해결하기 위한 두 학생의 대화를 듣고, 여자의 의견(요지)으로 가장 적절한 것을 고르는 5지선다 선택형 1문항',
    materialType: '대화문_생태전환(생태/환경보전)',
    source: '자체 제작(AI 생성)',
    transcript: `M: Hey, Sora. Look at the trash cans next to the school snack bar. They’re overflowing with plastic cups again.
W: Yeah, Minho. So many students buy cold drinks during break time and throw the cups away right after.
M: The student council put up posters saying "Bring Your Own Tumbler" last month, but nothing has changed.
W: Well, students often forget to bring their tumblers from home, or find it annoying to carry them around in their backpacks.
M: That’s true. Even I forget mine sometimes. Then how can we actually reduce plastic waste?
W: I think our school snack bar should introduce a shared reusable cup system.
M: You mean lending out cups at the snack bar?
W: Exactly. If students can borrow a clean reusable cup for their drink and simply drop it in a return box after use, everyone will participate easily.
M: That makes sense! Convenience is the key. Let’s suggest this idea to the student council.`,
    koreanTranslation:
      '남: 소라야, 학교 매점 옆 쓰레기통 좀 봐. 또 플라스틱 컵으로 넘쳐나고 있어.\n여: 그러게, 민호야. 쉬는 시간에 차가운 음료를 사 마시고 바로 컵을 버리는 학생들이 정말 많아.\n남: 지난달에 학생회에서 “개인 텀블러 가져오기” 포스터를 붙였는데 아무것도 달라지지 않았어.\n여: 음, 학생들이 집에서 텀블러를 가져오는 걸 자주 깜빡하거나 가방에 넣고 다니는 걸 번거로워하잖아.\n남: 맞아. 나조차도 가끔 잊어버려. 그럼 어떻게 해야 실제로 플라스틱 쓰레기를 줄일 수 있을까?\n여: 내 생각에는 우리 학교 매점에 다회용 컵 공유 제도를 도입해야 해.\n남: 매점에서 컵을 빌려주는 걸 말하는 거니?\n여: 맞아. 학생들이 음료를 마실 때 깨끗한 다회용 컵을 빌리고 다 마신 뒤 반납함에 넣기만 하면 모두가 쉽게 참여할 거야.\n남: 일리 있네! 편리함이 핵심이구나. 학생회에 이 아이디어를 건의해 보자.',
    questionPrompt: '대화를 듣고, 여자의 의견으로 가장 적절한 것을 고르시오.',
    stimulusTitle: '',
    stimulusBody: '',
    options: [
      '교내 매점의 플라스틱 음료 판매를 전면 금지해야 한다.',
      '환경 보호 포스터를 학생들의 눈에 잘 띄는 곳에 부착해야 한다.',
      '개인 텀블러를 지참하는 학생에게 음료 할인 혜택을 주어야 한다.',
      '일회용 컵을 줄이기 위해 교내 매점에 다회용 컵 공유 제도를 도입해야 한다.',
      '분리배출이 잘 이루어지도록 매점 옆에 재활용 쓰레기통을 추가 설치해야 한다.',
    ],
    isConstructedResponse: false,
    correctChoice: 4,
    modelAnswer: '',
    totalMarks: 2,
    rubricRows: [],
    explanation:
      '여자는 개인 텀블러 지참 캠페인의 불편함을 지적하며 “I think our school snack bar should introduce a shared reusable cup system.”이라고 직접 의견을 밝히고 있으므로 정답은 ④번이다.',
  },
  {
    id: 'sample-3',
    itemNo: 3,
    mode: 'ib',
    questionFormat: 'short_kr',
    includeOperationGuide: false,
    operationGuide: { ...DEFAULT_OPERATION_GUIDE },
    gradeSubject: '2학년 / 영어Ⅰ',
    evalMethod: '정기시험 혹은 수행평가(서술형/서답형)',
    achievementStandard: '[12영Ⅰ-01-03] 화자나 필자의 심정이나 의도를 추론한다.',
    directive: '추론',
    skill: '심정·의도 파악',
    topic: '사회생활',
    subtopic: '대인 관계',
    expressions: ['사과하고 수용하기', '도움 제안이나 요청하기', '의도 표현하기'],
    structures: ['Passive Voice', 'Gerunds', 'Anticipatory It', 'Relative Clauses'],
    vocabLevelId: 'high2_general',
    vocabLevelLabel: '일반·진로 선택 (2,000~2,500단어)',
    targetWordCount: 145,
    keyVocab: 'volunteer, regional qualifiers, venue, short notice, swap',
    difficulty: '상',
    taskDescription:
      '봉사활동 담당자에게 남긴 음성 메시지를 듣고, 화자가 메시지를 남긴 구체적인 의도(목적)와 사유를 파악하여 우리말로 서술하는 서답형 1문항',
    materialType: '담화문(음성 메시지)_사회생활(지역사회 봉사)',
    source: '자체 제작(AI 생성)',
    transcript: `M: Hello, Ms. Baker. This is Jason Kim, one of the high school volunteers for the Children’s English Storytelling Program at Central Library. I’m calling because I feel terrible about a mistake I made with my schedule. I signed up to read picture books to kids this Saturday morning. However, I just found out from my coach that the regional qualifiers for our school’s debate tournament were moved to this Saturday due to venue issues. Since I’m the team leader, I really can’t miss the competition. I’m truly sorry for letting you know on such short notice. Instead of canceling my shift completely, would it be possible to switch my volunteer slot with Mina Park, who is scheduled for next Saturday? She already agreed to swap if it’s okay with you. Please call me back when you get this message. Thank you.`,
    koreanTranslation:
      '남: 안녕하세요, 베이커 선생님. 중앙도서관 어린이 영어 동화 구연 프로그램 고등학생 봉사자 중 한 명인 제이슨 김입니다. 제 일정 관리 실수로 너무 죄송한 마음이 들어 전화를 드렸습니다. 저는 이번 주 토요일 오전에 아이들에게 그림책을 읽어 주기로 신청했었습니다. 그런데 장소 문제로 저희 학교 토론 대회 지역 예선이 이번 주 토요일로 변경되었다는 것을 코치님께 방금 들었습니다. 제가 팀장이라 대회에 빠질 수가 없습니다. 이렇게 급하게 알려 드려 정말 죄송합니다. 제 봉사 순번을 완전히 취소하는 대신, 다음 주 토요일로 예정된 박미나 학생과 제 봉사 시간대를 맞바꾸는 것이 가능할까요? 선생님만 괜찮으시다면 미나도 이미 바꾸기로 동의했습니다. 메시지를 확인하시면 연락 부탁드립니다. 감사합니다.',
    questionPrompt:
      '다음 음성 메시지를 듣고, 남자가 Ms. Baker에게 이 메시지를 남긴 궁극적인 ‘의도(요청 사항)’와 그렇게 해야만 하는 ‘이유’를 우리말로 구체적으로 서술하시오.',
    stimulusTitle: '',
    stimulusBody: `(1) 남자의 의도(요청 사항):\n(2) 요청하게 된 이유:`,
    options: ['', '', '', '', ''],
    isConstructedResponse: true,
    correctChoice: 1,
    modelAnswer: `• 의도(요청 사항): 이번 주 토요일 도서관 봉사활동 일정을 다음 주 토요일 담당자(Mina Park)와 맞바꾸고자(변경하고자) 함.\n• 이유: 학교 토론 대회 지역 예선 일정이 이번 주 토요일로 변경되어 팀장으로서 참석해야 하기 때문임.`,
    totalMarks: 4,
    rubricRows: [
      {
        id: 'r3-1',
        scoreLabel: '4점',
        criteria:
          '화자의 구체적인 요청 의도(봉사 일정 맞교환/변경)와 그 이유(토론 대회 일정 변경으로 인한 참가)를 모두 정확하게 서술한 경우',
      },
      {
        id: 'r3-2',
        scoreLabel: '2점',
        criteria:
          '두 가지 요소 중 하나는 정확하게 서술하였으나, 다른 하나가 다소 포괄적이거나 일부 세부 내용이 부정확한 경우 (예: ‘개인 사정 때문에 일정을 취소하려고’ 등)',
      },
      {
        id: 'r3-3',
        scoreLabel: '1점',
        criteria:
          '단순히 ‘봉사활동에 못 간다고 사과하기 위해서’처럼 표면적인 정보 일부만 서술한 경우',
      },
      {
        id: 'r3-4',
        scoreLabel: '0점',
        criteria: '의도와 이유를 모두 오해하여 서술하거나 답안을 작성하지 않은 경우',
      },
    ],
    explanation:
      '남자는 단순 취소가 아니라 “would it be possible to switch my volunteer slot with Mina Park, who is scheduled for next Saturday?”라고 요청하고 있으며, 그 이유로 “the regional qualifiers for our school’s debate tournament were moved to this Saturday”를 제시하고 있다.',
  },
  {
    id: 'sample-4',
    itemNo: 4,
    mode: 'ib',
    questionFormat: 'mcq_5',
    includeOperationGuide: false,
    operationGuide: { ...DEFAULT_OPERATION_GUIDE },
    gradeSubject: '2학년 / 영어Ⅱ',
    evalMethod: '정기시험(선택형)',
    achievementStandard: '[12영Ⅱ-01-04] 말이나 글에서 일이나 사건의 논리적 관계를 추론한다.',
    directive: '추론',
    skill: '논리적 관계 파악',
    topic: '민주시민',
    subtopic: '사회 현안',
    expressions: ['경험이나 사건 묘사하기', '정의하기', '설명 요청하기'],
    structures: ['Causative Verbs / Sensory Perception Verbs', 'Postmodification', 'Subordinating Conjunctions'],
    vocabLevelId: 'high2_general',
    vocabLevelLabel: '일반·진로 선택 (2,000~2,500단어)',
    targetWordCount: 150,
    keyVocab: 'scarcity effect, behavioral economics, anxiety, overestimate, rationally',
    difficulty: '상',
    taskDescription:
      '온라인 쇼핑의 마케팅 전략에 관한 대화를 듣고, 소비자가 충동구매에 이르게 되는 심리적 인과관계를 바르게 추론하는 선택형 1문항',
    materialType: '대화문_민주시민/사회(사회 현상)',
    source: '자체 제작(AI 생성)',
    transcript: `W: Hey, Daniel. What’s in that delivery box? Didn’t you buy sneakers last month?
M: Yeah, I did. Actually, I wasn’t planning to buy this jacket at all, but I ended up ordering it last night.
W: What made you buy it all of a sudden? Was there a huge discount?
M: Not really. While I was browsing an online store, a red message popped up saying, "Only 2 items left in stock, and 15 people are viewing this right now!"
W: Aha! You fell for the "scarcity effect" that we learned about in our behavioral economics class.
M: Wait, how does that work exactly?
W: When a product appears to be running out, people instantly feel a fear of missing out on a good opportunity. Because of that anxiety, they overestimate the item’s value and rush to buy it without thinking rationally.
M: That explains everything! I felt like I was going to lose something important if I didn’t click the buy button right away.
W: Online retailers use that exact psychological chain reaction to boost their sales.`,
    koreanTranslation:
      '여: 안녕, 다니엘. 그 택배 상자 안에는 뭐가 들어 있니? 지난달에 운동화 사지 않았어?\n남: 응, 샀지. 사실 이 재킷은 전혀 살 계획이 없었는데 어젯밤에 결국 주문해 버렸어.\n여: 왜 갑자기 사게 된 거야? 큰 폭의 할인이 있었니?\n남: 꼭 그렇진 않아. 온라인 쇼핑몰을 둘러보는데, “재고 단 2개 남음, 현재 15명이 보고 있습니다!”라는 빨간색 문구가 딱 뜨더라고.\n여: 아하! 우리가 행동경제학 시간에 배웠던 ‘희소성 효과’에 넘어갔구나.\n남: 잠깐, 그게 정확히 어떻게 작동하는 거지?\n여: 상품이 품절될 것처럼 보이면 사람들은 좋은 기회를 놓칠까 봐 즉각적인 두려움을 느껴. 그 불안감 때문에 상품의 가치를 과대평가하고 이성적으로 생각하지 않은 채 서둘러 구매하게 되는 거야.\n남: 이제 다 설명이 되네! 당장 구매 버튼을 누르지 않으면 중요한 걸 잃게 될 것 같은 기분이 들었거든.\n여: 온라인 판매자들은 매출을 올리기 위해 바로 그 심리적 연쇄 반응을 이용한단다.',
    questionPrompt:
      '대화를 듣고, 남자가 계획에 없던 재킷을 충동구매하게 된 심리적 원인으로 가장 적절한 것을 고르시오.',
    stimulusTitle: '',
    stimulusBody: '',
    options: [
      '대폭 할인된 가격을 보고 경제적 이득이 크다고 판단해서',
      '유명 인플루언서의 착용 후기를 보고 유행에 뒤처질까 걱정되어서',
      '품절 임박 문구로 인해 기회를 놓칠지도 모른다는 불안감이 생겨서',
      '무료 배송 혜택을 받기 위해 최소 주문 금액을 채워야 해서',
      '이전에 구매했던 같은 브랜드 운동화의 품질에 매우 만족해서',
    ],
    isConstructedResponse: false,
    correctChoice: 3,
    modelAnswer: '',
    totalMarks: 3,
    rubricRows: [],
    explanation:
      '남자는 할인 때문이 아니라 재고 부족 알림 문구를 보고 구매했으며, 여자는 이를 품절 임박 시 좋은 기회를 놓칠까 봐 불안감(fear of missing out / anxiety)을 느껴 서둘러 구매하는 희소성 효과(scarcity effect)로 설명하고 있으므로 정답은 ③번이다.',
  },
];
