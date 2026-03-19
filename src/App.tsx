import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

type LinkItem = { label: string; href: string };

type CardItem = {
  title: string;
  description: string;
};

const navLinks: LinkItem[] = [
  { label: "Как работает", href: "#how-it-works" },
  { label: "Возможности", href: "#features" },
  { label: "Сферы", href: "#industries" },
  { label: "FAQ", href: "#faq" }
];

const trustStats = ["24/7 ответы", "Быстрее реакция", "Больше записей"];

const problems: CardItem[] = [
  {
    title: "Отвечаете слишком поздно",
    description:
      "Лид оставляет заявку и уходит к конкуренту, если не получает ответ в первые минуты."
  },
  {
    title: "Теряете сообщения",
    description:
      "Запросы приходят в разные каналы, и часть обращений теряется без единой системы обработки."
  },
  {
    title: "Повторяете одно и то же",
    description:
      "Администраторы тратят часы на одинаковые вопросы вместо задач, которые двигают бизнес."
  },
  {
    title: "Нет квалификации лидов",
    description:
      "Без четкой логики сложно понять, кто готов записаться, а кому нужно больше прогрева."
  }
];

const solutionSteps: CardItem[] = [
  {
    title: "Мгновенный первый ответ",
    description: "AI встречает входящий запрос сразу и удерживает внимание клиента." 
  },
  {
    title: "Квалификация по сценарию",
    description: "Система задает нужные вопросы и отделяет горячие лиды от нецелевых." 
  },
  {
    title: "Доведение до записи",
    description: "Клиент получает следующий шаг: запись, звонок или подтверждение услуги." 
  },
  {
    title: "Передача человеку",
    description: "Нестандартные кейсы аккуратно эскалируются менеджеру или администратору." 
  }
];

const workSteps = [
  "Анализируем вашу воронку и точки потерь",
  "Проектируем AI-логику под ваш бизнес",
  "Подключаем каналы и сценарии обработки",
  "Запускаем и оптимизируем по данным"
];

const features: CardItem[] = [
  { title: "Мгновенные ответы", description: "Клиент получает реакцию сразу, даже вне рабочего времени." },
  { title: "Квалификация лидов", description: "Сбор ключевой информации до передачи в продажу." },
  { title: "Автоответы на FAQ", description: "Снятие рутинной нагрузки с команды." },
  { title: "Передача в запись", description: "Переход к бронированию без лишних шагов." },
  { title: "Логика продаж", description: "Сценарии разговоров под ваш процесс и услуги." },
  { title: "Интеграция с CRM", description: "Данные по лидам готовы к работе в вашей системе." },
  { title: "Многошаговые диалоги", description: "От первого касания до готовности купить." },
  { title: "Стабильность 24/7", description: "Система работает без пауз и выходных." }
];

const industries: CardItem[] = [
  {
    title: "Салоны красоты",
    description: "Автоматизация вопросов по услугам, стоимости, свободным слотам и записи."
  },
  {
    title: "Барбершопы",
    description: "Быстрая обработка входящих заявок и управление потоком повторных клиентов."
  },
  {
    title: "Клиники",
    description: "Маршрутизация запросов, первичная квалификация и снижение нагрузки на регистратуру."
  },
  {
    title: "Локальный сервис",
    description: "Стандартизация общения с клиентами и ускорение ответа по типовым обращениям."
  },
  {
    title: "Эксперты и консультанты",
    description: "Отбор целевых клиентов и доведение до консультации или созвона."
  }
];

const outcomes = [
  "Меньше потерянных лидов",
  "Более быстрый отклик",
  "Меньше ручной рутины",
  "Больше записей и продаж",
  "Ровный путь клиента до сделки"
];

const whyClientsFlow: CardItem[] = [
  {
    title: "Сделаем за вас",
    description: "Вы получаете готовую систему, а не набор сложных инструментов для самостоятельной сборки."
  },
  {
    title: "Под ваш бизнес",
    description: "Сценарии строятся по вашим услугам, этапам продаж и типу клиентов."
  },
  {
    title: "Логика воронки, а не чат ради чата",
    description: "Фокус на конверсии в запись и продажу, а не на демонстрации технологии."
  },
  {
    title: "Постоянная оптимизация",
    description: "После запуска улучшаем сценарии на основе реальных диалогов и метрик."
  }
];

const faqItems = [
  {
    question: "Это будет звучать роботизированно?",
    answer:
      "Нет. Мы настраиваем тон и сценарии под ваш стиль общения, чтобы диалоги выглядели естественно и уверенно."
  },
  {
    question: "Можно адаптировать под мой бизнес?",
    answer:
      "Да. ClientsFlow проектируется индивидуально: услуги, частые возражения, этапы записи и логика квалификации."
  },
  {
    question: "Система заменит администратора?",
    answer:
      "Она снимает рутину и закрывает повторяющиеся сценарии. Команда фокусируется на важных и нестандартных задачах."
  },
  {
    question: "Что если клиент задаст нестандартный вопрос?",
    answer:
      "Сложные кейсы автоматически передаются менеджеру с контекстом, чтобы ответить быстро и точно."
  },
  {
    question: "Сколько занимает запуск?",
    answer:
      "Обычно первый рабочий запуск возможен за 7-14 дней, в зависимости от сложности процессов и каналов."
  }
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={reveal}
      transition={{ duration: 0.55 }}
      className="mx-auto mb-12 max-w-3xl text-center"
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-4 text-lg leading-relaxed text-slate-600">{subtitle}</p> : null}
    </motion.div>
  );
}

function GlassCard({ title, description, index }: CardItem & { index: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={reveal}
      transition={{ duration: 0.45, delay: index * 0.04 }}
      className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-soft backdrop-blur"
    >
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-3 leading-relaxed text-slate-600">{description}</p>
    </motion.div>
  );
}

export default function App() {
  const [openFaq, setOpenFaq] = useState(0);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen bg-hero-gradient text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-slate-50/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <a href="#top" className="text-lg font-extrabold tracking-tight text-slate-900">ClientsFlow</a>
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href="#final-cta"
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Book a Demo
          </a>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 md:px-8 lg:grid-cols-2 lg:pt-20">
          <motion.div initial="hidden" animate="visible" variants={reveal} transition={{ duration: 0.6 }}>
            <p className="mb-5 inline-flex rounded-full border border-cyan-200 bg-cyan-100/70 px-4 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">
              AI клиентские операции под ключ
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-950 md:text-6xl">
              Перестаньте терять лиды. Автоматизируйте клиентские коммуникации с AI.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              ClientsFlow создает для бизнеса систему, которая отвечает мгновенно, квалифицирует обращения и доводит клиента до записи или сделки.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#final-cta"
                className="rounded-full bg-slate-900 px-7 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-700"
              >
                Book a Demo
              </a>
              <a
                href="#how-it-works"
                className="rounded-full border border-slate-300 bg-white px-7 py-3 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-500"
              >
                See How It Works
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-glow"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">AI Operations Panel</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Активно</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { state: "Новый лид", value: "18" },
                { state: "Квалифицирован", value: "11" },
                { state: "Ожидает записи", value: "7" },
                { state: "Эскалация менеджеру", value: "3" }
              ].map((item) => (
                <div key={item.state} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{item.state}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700">Автоматизация сценария</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>1. Входящий запрос {"->"} ответ до 5 секунд</p>
                <p>2. Проверка намерения и бюджета</p>
                <p>3. Предложение свободного окна для записи</p>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="border-y border-slate-200 bg-white/80">
          <div className="mx-auto max-w-6xl px-4 py-7 md:px-8">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Создано для сервисного бизнеса, который не может терять входящие обращения
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {trustStats.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <SectionTitle
            eyebrow="Проблема"
            title="Большинство лидов теряется не из-за рекламы, а из-за скорости ответа"
            subtitle="Когда нет системы коммуникаций, бизнес ежедневно теряет заявки и выручку."
          />
          <div className="grid gap-5 md:grid-cols-2">
            {problems.map((item, index) => (
              <GlassCard key={item.title} index={index} {...item} />
            ))}
          </div>
        </section>

        <section className="bg-white/85 py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <SectionTitle
              eyebrow="Решение"
              title="ClientsFlow берет коммуникацию с лидами на себя"
              subtitle="Мы строим операционную AI-систему, которая закрывает рутину и ведет клиента к действию."
            />
            <div className="grid gap-5 md:grid-cols-2">
              {solutionSteps.map((item, index) => (
                <GlassCard key={item.title} index={index} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <SectionTitle eyebrow="Процесс" title="Как мы запускаем систему в вашем бизнесе" />
          <div className="grid gap-4 md:grid-cols-4">
            {workSteps.map((step, index) => (
              <motion.div
                key={step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.35 }}
                variants={reveal}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft"
              >
                <p className="mb-4 text-3xl font-black text-cyan-700">0{index + 1}</p>
                <p className="font-semibold leading-relaxed text-slate-700">{step}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="features" className="bg-white/85 py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <SectionTitle
              eyebrow="Возможности"
              title="Функциональность, которая помогает конвертировать обращения в клиентов"
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {features.map((item, index) => (
                <GlassCard key={item.title} index={index} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <SectionTitle
            eyebrow="Система"
            title="Визуальный контроль работы AI-воронки"
            subtitle="Прозрачные статусы по каждому лиду: от входящего запроса до записи или передачи в работу менеджеру."
          />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={reveal}
            transition={{ duration: 0.6 }}
            className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Поток лидов</p>
                <div className="mt-4 space-y-3">
                  {["Новый лид", "Квалифицирован", "Ожидает записи", "Закрыт в продажу"].map((status) => (
                    <div key={status} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      {status}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Workflow Logic</p>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>Если запрос срочный {"->"} приоритетный маршрут</p>
                  <p>Если нецелевой лид {"->"} мягкая фильтрация</p>
                  <p>Если есть намерение {"->"} переход к записи</p>
                  <p>Если сложный случай {"->"} менеджеру</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">Оперативные метрики</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    ["Средний ответ", "6 сек"],
                    ["Лиды за день", "+42"],
                    ["Квалификация", "71%"],
                    ["Запись", "38%"]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="mt-1 text-xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="industries" className="bg-white/85 py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <SectionTitle
              eyebrow="Сферы"
              title="Кому подходит ClientsFlow"
              subtitle="Для бизнесов, где скорость ответа напрямую влияет на запись, загрузку и выручку."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {industries.map((item, index) => (
                <GlassCard key={item.title} index={index} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-20 md:px-8 lg:grid-cols-2">
          <div>
            <SectionTitle
              eyebrow="Результат"
              title="Понятные бизнес-эффекты уже после запуска"
              subtitle="Автоматизация должна повышать конверсию, а не добавлять вам сложность."
            />
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
            variants={reveal}
            transition={{ duration: 0.6 }}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {outcomes.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="bg-white/85 py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <SectionTitle
              eyebrow="Почему ClientsFlow"
              title="Бизнесу нужен внедренный результат, а не очередной AI-инструмент"
            />
            <div className="grid gap-4 md:grid-cols-2">
              {whyClientsFlow.map((item, index) => (
                <GlassCard key={item.title} index={index} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-4xl px-4 py-20 md:px-8">
          <SectionTitle eyebrow="FAQ" title="Частые вопросы перед запуском" />
          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div key={item.question} className="rounded-2xl border border-slate-200 bg-white shadow-soft">
                  <button
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  >
                    <span className="font-semibold text-slate-900">{item.question}</span>
                    <span className="text-xl font-bold text-cyan-700">{isOpen ? "−" : "+"}</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24 }}
                        className="overflow-hidden px-5"
                      >
                        <p className="pb-4 leading-relaxed text-slate-600">{item.answer}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        <section id="final-cta" className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={reveal}
            transition={{ duration: 0.55 }}
            className="rounded-[2.2rem] border border-slate-200 bg-slate-900 px-6 py-14 text-center text-white shadow-soft md:px-12"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Готовый следующий шаг</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">
              Пусть бизнес отвечает мгновенно, даже когда вы заняты
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Получите персональную AI-систему клиентских коммуникаций, которая помогает не терять входящие обращения и доводить лиды до записи.
            </p>
            <a
              href="#top"
              className="mt-8 inline-flex rounded-full bg-cyan-400 px-8 py-3 text-sm font-bold text-slate-900 transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Book a Demo
            </a>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-semibold text-slate-700">ClientsFlow</p>
          <div className="flex flex-wrap items-center gap-5">
            {[
              "Services",
              "How It Works",
              "Industries",
              "FAQ",
              "Contact"
            ].map((item) => (
              <a key={item} href="#" className="transition hover:text-slate-900">
                {item}
              </a>
            ))}
          </div>
          <p>© {currentYear} ClientsFlow</p>
        </div>
      </footer>
    </div>
  );
}
