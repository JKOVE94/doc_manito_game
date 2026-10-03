import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "시크릿 히틀러 룰북 | 대현목장 시크릿 마니또",
  description: "처음 하는 사람을 위한 시크릿 히틀러 한국어 규칙 요약",
};

// 인원별 진영 구성 (자유주의자 / 파시스트 / 히틀러)
const SETUP = [
  { n: 5, lib: 3, fas: 1 },
  { n: 6, lib: 4, fas: 1 },
  { n: 7, lib: 4, fas: 2 },
  { n: 8, lib: 5, fas: 2 },
  { n: 9, lib: 5, fas: 3 },
  { n: 10, lib: 6, fas: 3 },
];

// 파시스트 정책 n번째 통과 시 대통령 권한 (인원 구간별)
const POWERS: { group: string; slots: string[] }[] = [
  { group: "5~6명", slots: ["–", "–", "🔍 정책 엿보기", "🔫 처형", "🔫 처형 + 거부권"] },
  { group: "7~8명", slots: ["–", "🕵️ 충성 조사", "🗳️ 특별 선거", "🔫 처형", "🔫 처형 + 거부권"] },
  { group: "9~10명", slots: ["🕵️ 충성 조사", "🕵️ 충성 조사", "🗳️ 특별 선거", "🔫 처형", "🔫 처형 + 거부권"] },
];

function Section({ id, title, children, open = false }: { id: string; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details id={id} open={open} className="group rounded-2xl border border-line bg-surface p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[17px] font-bold tracking-tight">
        {title}
        <span className="text-ink-soft transition group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink">{children}</div>
    </details>
  );
}

function Term({ ko, en }: { ko: string; en: string }) {
  return (
    <span className="whitespace-nowrap">
      <b>{ko}</b> <span className="text-xs text-ink-soft">({en})</span>
    </span>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-brand/10 p-3 text-sm text-ink">💡 {children}</p>;
}

export default function RulesPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
      <header className="mb-5">
        <Link href="/play" className="inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink">
          ← 게임으로 돌아가기
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">📖 시크릿 히틀러 룰북</h1>
        <p className="mt-1 text-sm text-ink-soft">처음 하는 사람을 위한 한국어 요약 · 영문 카드 용어 병기</p>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2 text-xs">
        {[
          ["goal", "승리 조건"],
          ["setup", "준비"],
          ["round", "라운드 진행"],
          ["powers", "대통령 권한"],
          ["etc", "세부 규칙"],
          ["party", "우리 파티 연계"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full bg-surface-2 px-3 py-1.5 font-semibold text-ink-soft">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-3">
        <Section id="summary" title="⚡ 30초 요약" open>
          <p>
            1930년대 독일 의회가 배경인 <b>정체 숨기기 게임</b>이에요. 다수의 <Term ko="자유주의자" en="Liberal" />와
            소수의 <Term ko="파시스트" en="Fascist" />로 나뉘고, 파시스트 중 한 명은 <Term ko="히틀러" en="Hitler" />예요.
          </p>
          <p>
            파시스트는 서로가 누군지 알지만, 자유주의자는 아무도 몰라요. 매 라운드 <b>대통령</b>과 <b>수상</b>을 뽑아 정책을
            통과시키는데, 정책 카드는 비공개로 고르기 때문에 <b>누가 거짓말하는지</b> 추리하는 게 핵심이에요.
          </p>
          <Tip>모두 거짓말을 해도 됩니다. 단, 게임이 끝났을 때는 정체를 공개해요.</Tip>
        </Section>

        <Section id="goal" title="🏆 승리 조건">
          <div className="rounded-xl border border-line p-3">
            <p className="font-bold text-accent">🕊️ 자유주의자 승리</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>자유주의 정책 <b>5장</b> 통과</li>
              <li>또는 <b>히틀러를 처형</b></li>
            </ul>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="font-bold text-danger">🦅 파시스트 승리</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>파시스트 정책 <b>6장</b> 통과</li>
              <li>
                또는 파시스트 정책이 <b>3장 이상</b> 통과된 뒤, <b>히틀러가 수상으로 당선</b>
              </li>
            </ul>
          </div>
          <Tip>파시스트 정책이 3장 쌓이면 수상 선거 하나하나가 위험해져요. 이때부터 수상 후보를 신중히!</Tip>
        </Section>

        <Section id="setup" title="🃏 준비 (인원별 구성)">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-center text-sm">
              <thead className="bg-surface-2 text-xs text-ink-soft">
                <tr>
                  <th className="py-2">인원</th>
                  <th>자유주의자</th>
                  <th>파시스트</th>
                  <th>히틀러</th>
                </tr>
              </thead>
              <tbody>
                {SETUP.map((r) => (
                  <tr key={r.n} className="border-t border-line">
                    <td className="py-2 font-bold">{r.n}명</td>
                    <td>{r.lib}</td>
                    <td>{r.fas}</td>
                    <td>1</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            정책 카드 덱: <b>자유주의 6장 + 파시스트 11장</b> (파시스트 카드가 훨씬 많아요!). 인원에 맞는 파시스트 보드를
            사용하세요.
          </p>
          <p className="font-bold">🌙 밤 단계 (정체 확인)</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              각자 비밀 역할 카드(<Term ko="역할" en="Secret Role" />)와 같은 진영의 <Term ko="당원 카드" en="Party Membership" />
              를 받아요.
            </li>
            <li>모두 눈을 감아요.</li>
            <li>
              <b>5~6명:</b> 파시스트와 히틀러가 눈을 떠서 서로를 확인해요.
            </li>
            <li>
              <b>7~10명:</b> 파시스트만 눈을 떠 서로를 확인하고, 히틀러는 눈을 감은 채 엄지를 들어 정체만 알려줘요.
              (히틀러는 동료를 몰라요)
            </li>
            <li>모두 눈을 떠요. 이제 시작!</li>
          </ol>
        </Section>

        <Section id="round" title="🔄 라운드 진행">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <b>대통령 후보 이동</b> — <Term ko="대통령" en="President" /> 후보 자리가 시계 방향으로 한 칸씩 넘어가요.
            </li>
            <li>
              <b>수상 지명</b> — 대통령 후보가 <Term ko="수상" en="Chancellor" /> 후보 1명을 지명해요.
              <br />
              <span className="text-sm text-ink-soft">
                직전에 당선된 대통령·수상은 수상 후보가 될 수 없어요. (5명일 때는 직전 수상만 제외)
              </span>
            </li>
            <li>
              <b>투표</b> — 모두 동시에 <Term ko="찬성" en="Ja!" /> / <Term ko="반대" en="Nein!" /> 카드를 공개해요.{" "}
              <b>과반 찬성</b>이면 당선, 동률이면 부결.
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                <li>
                  부결되면 <Term ko="선거 추적기" en="Election Tracker" />가 1칸 전진하고 다음 사람이 대통령 후보가 돼요.
                </li>
                <li>
                  <b>3번 연속 부결</b>되면 덱 맨 위 정책이 자동 통과(권한 없음)되고, 추적기와 연임 제한이 초기화돼요.
                </li>
              </ul>
            </li>
            <li>
              <b>입법</b> (당선 시) — 대화 금지!
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                <li>대통령이 정책 3장을 뽑아 몰래 1장을 버리고 2장을 수상에게 넘겨요.</li>
                <li>수상이 1장을 버리고 남은 1장을 공개해 통과시켜요.</li>
                <li>버린 카드는 공개하지 않아요. 어떤 카드였는지는 말로만 주장할 수 있고, 거짓말도 가능해요.</li>
              </ul>
            </li>
            <li>
              <b>대통령 권한</b> — 파시스트 정책이 통과돼 권한 칸이 열리면 대통령이 즉시 사용해요. (다음 섹션)
            </li>
          </ol>
          <Tip>
            파시스트 정책이 3장 이상일 때 수상이 당선되면, 바로 &ldquo;당신이 히틀러인가요?&rdquo;를 확인해요. 히틀러면 그
            즉시 파시스트 승리!
          </Tip>
        </Section>

        <Section id="powers" title="⚡ 대통령 권한 (파시스트 보드)">
          <p className="text-sm text-ink-soft">파시스트 정책이 n번째로 통과될 때 열리는 권한이에요.</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-center text-xs">
              <thead className="bg-surface-2 text-ink-soft">
                <tr>
                  <th className="px-1 py-2">인원</th>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <th key={n} className="px-1">
                      {n}번째
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POWERS.map((r) => (
                  <tr key={r.group} className="border-t border-line">
                    <td className="px-1 py-2 font-bold">{r.group}</td>
                    {r.slots.map((s, i) => (
                      <td key={i} className="px-1">
                        {s}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2">
            <li>
              <b>🔍 정책 엿보기</b> <span className="text-xs text-ink-soft">(Policy Peek)</span> — 대통령이 덱 위 3장을 몰래
              보고 그대로 돌려놔요.
            </li>
            <li>
              <b>🕵️ 충성 조사</b> <span className="text-xs text-ink-soft">(Investigate Loyalty)</span> — 한 명의 당원 카드를
              대통령만 확인해요. 히틀러도 &lsquo;파시스트&rsquo;로 보여요. 같은 사람은 두 번 조사할 수 없어요.
            </li>
            <li>
              <b>🗳️ 특별 선거</b> <span className="text-xs text-ink-soft">(Call Special Election)</span> — 대통령이 다음
              대통령 후보를 아무나 지정해요. 그 라운드가 끝나면 원래 순서로 돌아가요.
            </li>
            <li>
              <b>🔫 처형</b> <span className="text-xs text-ink-soft">(Execution)</span> — 한 명을 게임에서 제외해요. 처형된
              사람이 히틀러면 자유주의자 승리! 아니면 정체는 공개하지 않고, 그 사람은 말하거나 투표할 수 없어요.
            </li>
            <li>
              <b>✋ 거부권</b> <span className="text-xs text-ink-soft">(Veto Power)</span> — 파시스트 정책 5장 이후,
              수상이 받은 2장을 모두 거부하자고 제안할 수 있어요. 대통령이 동의하면 둘 다 버리고 선거 추적기가 1칸 전진해요.
            </li>
          </ul>
        </Section>

        <Section id="etc" title="📌 세부 규칙 & 자주 하는 실수">
          <ul className="list-disc space-y-2 pl-5">
            <li>정책 덱이 3장 미만이 되면 버린 카드와 합쳐 다시 섞어요.</li>
            <li>입법 중(대통령→수상 카드 전달)에는 서로 말하거나 신호를 주면 안 돼요.</li>
            <li>투표는 반드시 모두 동시에 공개해요.</li>
            <li>버린 카드, 조사 결과, 엿본 정책은 말로만 공유하고, 카드는 보여주지 않아요. 거짓말도 전략이에요.</li>
            <li>처형된 사람은 게임이 끝날 때까지 침묵해요.</li>
            <li>자유주의자 정책이 잘 안 나오는 건 덱 구성(6:11) 때문일 수 있어요. 무조건 거짓말로 단정하지 마세요!</li>
          </ul>
        </Section>

        <Section id="party" title="🎁 우리 파티 연계 (배팅 & 히든 퀘스트)">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              게임 시작 전, 앱의 <b>🎲 배팅 탭</b>에서 내 <b>진영</b>과 <b>승/패 예측</b>을 제출해요. 진영은 서버에만 저장되고 다른
              사람에게 보이지 않아요.
            </li>
            <li>호스트가 배팅을 잠근 뒤 게임을 진행하고, 끝나면 승리 진영을 발표해 적중 여부가 공개돼요.</li>
            <li>
              <b>🎴 히든 퀘스트</b>는 내가 섬기는 친구를 지지하거나 견제하는 개인 미션이에요. 게임 중 몰래 수행해 보세요. 들키면
              마니또 정체가 드러날 수도 있어요!
            </li>
          </ul>
          <Link
            href="/play"
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-[15px] font-semibold text-brand-ink"
          >
            🎲 배팅하러 가기
          </Link>
        </Section>
      </div>

      <footer className="mt-8 text-center text-[11px] leading-relaxed text-ink-soft">
        Secret Hitler © Goat, Wolf, &amp; Cabbage LLC — CC BY-NC-SA 4.0.
        <br />이 페이지는 비영리 파티용 한국어 규칙 요약이며 원문의 번역·각색물입니다. 정확한 규칙은 원본 룰북을 따르세요.
      </footer>
    </main>
  );
}
