import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_USERS = [
  { email: "sathvik@testify.app", name: "Sathvik", role: "ADMIN" },
  { email: "arjun@testify.app", name: "Arjun", role: "STUDENT" },
  { email: "priya@testify.app", name: "Priya", role: "STUDENT" },
];

async function main() {
  // Clean slate
  await prisma.studentAnswer.deleteMany({});
  await prisma.examSession.deleteMany({});
  await prisma.batchPaper.deleteMany({});
  await prisma.batchMember.deleteMany({});
  await prisma.batch.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.questionSet.deleteMany({});
  await prisma.authSession.deleteMany({});
  await prisma.user.deleteMany({});

  // Demo users (all password: "password123")
  const passwordHash = await bcrypt.hash("password123", 10);
  for (const u of DEMO_USERS) {
    await prisma.user.create({ data: { email: u.email, name: u.name, passwordHash, role: u.role } });
  }
  console.log(`✅ Seeded ${DEMO_USERS.length} demo users (password: password123)`);
  for (const u of DEMO_USERS) console.log(`   - ${u.email}`);

  const set = await prisma.questionSet.create({
    data: {
      name: "JEE Main 2026 — Full Physics & Chemistry",
      subject: "Physics & Chemistry",
      pattern: "JEE Main",
      timeLimit: 600,
      kind: "INSTITUTE",
      exam: "JEE_MAIN",
      tags: JSON.stringify(["Full Syllabus", "Grand Test"]),
    },
  });

  const questions = [
    {
      setId: set.id,
      type: "mcq",
      order: 1,
      topic: "Kinematics",
      text: `A particle moves along a straight line with velocity $v = 3t^2 + 2t$ m/s. What is the displacement of the particle from $t = 0$ to $t = 3$ s?

Given the velocity function:
$$v(t) = 3t^2 + 2t$$

The displacement is calculated by integrating velocity over time:
$$s = \\int_0^3 v(t) \\, dt = \\int_0^3 (3t^2 + 2t) \\, dt$$`,
      options: JSON.stringify(["$27 \\text{ m}$", "$30 \\text{ m}$", "$36 \\text{ m}$", "$45 \\text{ m}$"]),
      correctAnswer: "C",
      explanation: `Step-by-step solution:

$$s = \\int_0^3 (3t^2 + 2t) \\, dt$$

$$= \\left[ t^3 + t^2 \\right]_0^3$$

$$= (3^3 + 3^2) - (0^3 + 0^2)$$

$$= 27 + 9 = 36 \\text{ m}$$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 2,
      topic: "Work, Energy & Power",
      text: `A body of mass $m = 5 \\text{ kg}$ is raised vertically to a height of $h = 10 \\text{ m}$. The work done against gravity is: (Take $g = 10 \\text{ m/s}^2$)

$$W = mgh$$`,
      options: JSON.stringify(["$250 \\text{ J}$", "$400 \\text{ J}$", "$500 \\text{ J}$", "$600 \\text{ J}$"]),
      correctAnswer: "C",
      explanation: `Work done against gravity equals the change in gravitational potential energy:

$$W = \\Delta U = mgh$$

$$W = 5 \\times 10 \\times 10 = 500 \\text{ J}$$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 3,
      topic: "Thermodynamics",
      text: `In a thermodynamic process, a system absorbs $Q = 200 \\text{ J}$ of heat and does $W = 80 \\text{ J}$ of work on the surroundings. What is the change in internal energy?

First Law of Thermodynamics:
$$\\Delta U = Q - W$$`,
      options: JSON.stringify(["$-120 \\text{ J}$", "$80 \\text{ J}$", "$120 \\text{ J}$", "$280 \\text{ J}$"]),
      correctAnswer: "C",
      explanation: `Applying the First Law of Thermodynamics:

$$\\Delta U = Q - W$$

Where:
- $Q = +200 \\text{ J}$ (heat absorbed by system, positive)
- $W = +80 \\text{ J}$ (work done by system, positive)

$$\\Delta U = 200 - 80 = 120 \\text{ J}$$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "numeric",
      order: 4,
      topic: "Gravitation",
      text: `Two bodies of masses $m_1 = 4 \\text{ kg}$ and $m_2 = 9 \\text{ kg}$ are placed $1 \\text{ m}$ apart. At what distance (in cm) from the smaller mass will the gravitational field intensity be zero?

At the neutral point:
$$G\\frac{m_1}{r^2} = G\\frac{m_2}{(1-r)^2}$$`,
      options: null,
      correctAnswer: "40",
      explanation: `Setting gravitational fields equal:

$$\\frac{4}{r^2} = \\frac{9}{(1-r)^2}$$

Taking square roots:
$$\\frac{2}{r} = \\frac{3}{1-r}$$

$$2(1-r) = 3r$$

$$2 - 2r = 3r$$

$$r = 0.4 \\text{ m} = 40 \\text{ cm}$$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 5,
      topic: "Electrostatics",
      text: `Three identical charges $+q$ are placed at the vertices of an equilateral triangle of side $a$. What is the magnitude of the net force on any one charge?

The force between any two charges:
$$F = \\frac{1}{4\\pi\\varepsilon_0} \\frac{q^2}{a^2}$$`,
      options: JSON.stringify([
        "Zero",
        "$\\sqrt{3} \\cdot \\frac{1}{4\\pi\\varepsilon_0} \\frac{q^2}{a^2}$",
        "$\\frac{1}{4\\pi\\varepsilon_0} \\frac{q^2}{a^2}$",
        "$\\sqrt{3} \\cdot \\frac{1}{\\pi\\varepsilon_0} \\frac{q^2}{a^2}$"
      ]),
      correctAnswer: "B",
      explanation: `Each charge experiences two forces of magnitude:

$$F = \\frac{1}{4\\pi\\varepsilon_0} \\frac{q^2}{a^2}$$

At $60°$ to each other. The resultant:

$$F_{net} = \\sqrt{F^2 + F^2 + 2F^2\\cos 60°} = \\sqrt{3}F$$

$$F_{net} = \\sqrt{3} \\cdot \\frac{1}{4\\pi\\varepsilon_0} \\frac{q^2}{a^2}$$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 6,
      topic: "Organic Chemistry",
      text: `Which of the following carbocations is the most stable?

$$\\text{(I) } CH_3^+ \\quad \\text{(II) } CH_3CH_2^+ \\quad \\text{(III) } (CH_3)_2CH^+ \\quad \\text{(IV) } (CH_3)_3C^+$$`,
      options: JSON.stringify(["$CH_3^+$", "$CH_3CH_2^+$", "$(CH_3)_2CH^+$", "$(CH_3)_3C^+$"]),
      correctAnswer: "D",
      explanation: `Carbocation stability depends on:
- Hyperconjugation (+H effect)
- Inductive effect (+I effect)

$(CH_3)_3C^+$ has 9 $\\alpha$-hydrogens for hyperconjugation and three methyl groups exerting +I effect.

Stability order: $3° > 2° > 1° > \\text{methyl}$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "numeric",
      order: 7,
      topic: "Mole Concept",
      text: `How many moles of oxygen atoms are present in $9.8 \\text{ g}$ of $H_2SO_4$? (Molar mass of $H_2SO_4 = 98 \\text{ g/mol}$)

$$n = \\frac{w}{M}$$`,
      options: null,
      correctAnswer: "0.4",
      explanation: `Step 1: Calculate moles of $H_2SO_4$
$$n_{H_2SO_4} = \\frac{9.8}{98} = 0.1 \\text{ mol}$$

Step 2: Each $H_2SO_4$ contains 4 oxygen atoms
$$n_O = 0.1 \\times 4 = 0.4 \\text{ mol}$$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 8,
      topic: "Chemical Bonding",
      text: `Which of the following molecules has the highest bond dissociation energy?

Bond dissociation energy is the energy required to break a bond:
$$X_2 \\rightarrow 2X \\quad \\Delta H = \\text{BDE}$$`,
      options: JSON.stringify(["$F_2$", "$Cl_2$", "$Br_2$", "$I_2$"]),
      correctAnswer: "B",
      explanation: `Bond dissociation energies (kJ/mol):
- $Cl_2$: 243
- $Br_2$: 192
- $F_2$: 159
- $I_2$: 151

$Cl_2$ has the highest BDE. $F_2$ is anomalous due to small size causing lone pair repulsion.`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 9,
      topic: "Modern Physics",
      text: `The de Broglie wavelength of an electron accelerated through $V = 100 \\text{ V}$ is approximately:

$$\\lambda = \\frac{h}{\\sqrt{2meV}} = \\frac{1.226}{\\sqrt{V}} \\text{ nm}$$`,
      options: JSON.stringify(["$0.123 \\text{ nm}$", "$0.246 \\text{ nm}$", "$1.23 \\text{ nm}$", "$2.46 \\text{ nm}$"]),
      correctAnswer: "A",
      explanation: `Using the de Broglie wavelength formula:

$$\\lambda = \\frac{1.226}{\\sqrt{V}} \\text{ nm}$$

$$\\lambda = \\frac{1.226}{\\sqrt{100}} = \\frac{1.226}{10} = 0.1226 \\text{ nm}$$

$$\\approx 0.123 \\text{ nm}$$`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 10,
      topic: "Optics",
      text: `A convex lens of focal length $f = 20 \\text{ cm}$ forms a real image of an object placed at $u = 30 \\text{ cm}$. The magnification produced is:

Lens formula:
$$\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}$$`,
      options: JSON.stringify(["$-2$", "$-1$", "$1$", "$2$"]),
      correctAnswer: "A",
      explanation: `Using lens formula:
$$\\frac{1}{20} = \\frac{1}{v} + \\frac{1}{30}$$

$$\\frac{1}{v} = \\frac{1}{20} - \\frac{1}{30} = \\frac{3-2}{60} = \\frac{1}{60}$$

$$v = 60 \\text{ cm}$$

Magnification:
$$m = \\frac{v}{u} = \\frac{60}{-30} = -2$$

Negative sign indicates inverted image.`,
      imageUrl: null,
      images: null,
    },
    // Questions with images for testing
    {
      setId: set.id,
      type: "mcq",
      order: 11,
      topic: "Mechanics",
      text: `A block of mass $m$ slides down a frictionless inclined plane making angle $\\theta$ with the horizontal. The acceleration of the block is:

$$a = g \\sin \\theta$$`,
      options: JSON.stringify(["$g \\sin \\theta$", "$g \\cos \\theta$", "$g \\tan \\theta$", "$g$"]),
      correctAnswer: "A",
      explanation: `Resolving forces along the incline:

Component of gravity along the plane: $mg \\sin \\theta$

By Newton's Second Law:
$$ma = mg \\sin \\theta$$

$$a = g \\sin \\theta$$`,
      imageUrl: "https://images.unsplash.com/photo-1635070041078-ea128d1822e3?w=600&h=300&fit=crop",
      images: JSON.stringify([
        { url: "https://images.unsplash.com/photo-1635070041078-ea128d1822e3?w=400&h=300&fit=crop", caption: "Inclined plane setup" }
      ]),
    },
    {
      setId: set.id,
      type: "mcq",
      order: 12,
      topic: "Electrostatics",
      text: `In the capacitor network shown below, three capacitors each of $4 \\mu F$ are connected in parallel. The equivalent capacitance between points A and B is:

For parallel combination:
$$C_{eq} = C_1 + C_2 + C_3$$`,
      options: JSON.stringify(["$4 \\mu F$", "$8 \\mu F$", "$12 \\mu F$", "$16 \\mu F$"]),
      correctAnswer: "C",
      explanation: `For capacitors in parallel:

$$C_{eq} = C_1 + C_2 + C_3$$

$$C_{eq} = 4 + 4 + 4 = 12 \\mu F$$

In parallel, the effective capacitance is the sum of individual capacitances.`,
      imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=300&fit=crop",
      images: JSON.stringify([
        { url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop", caption: "Capacitor circuit diagram" },
        { url: "https://images.unsplash.com/photo-1635070041078-ea128d1822e3?w=400&h=250&fit=crop", caption: "Equivalent circuit" }
      ]),
    },
    {
      setId: set.id,
      type: "mcq",
      order: 13,
      topic: "Rotational Mechanics",
      text: `A solid sphere of mass $M$ and radius $R$ rolls down an inclined plane without slipping. The acceleration of the center of mass is:

For rolling without slipping:
$$a = \\frac{g \\sin \\theta}{1 + \\frac{I}{MR^2}}$$`,
      options: JSON.stringify([
        "$\\frac{5}{7}g \\sin \\theta$",
        "$\\frac{2}{5}g \\sin \\theta$",
        "$\\frac{3}{5}g \\sin \\theta$",
        "$g \\sin \\theta$"
      ]),
      correctAnswer: "A",
      explanation: `For a solid sphere:

Moment of inertia: $I = \\frac{2}{5}MR^2$

Using the rolling constraint:
$$a = \\frac{g \\sin \\theta}{1 + \\frac{I}{MR^2}} = \\frac{g \\sin \\theta}{1 + \\frac{2}{5}}$$

$$a = \\frac{g \\sin \\theta}{\\frac{7}{5}} = \\frac{5}{7}g \\sin \\theta$$`,
      imageUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600&h=300&fit=crop",
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 14,
      topic: "Nuclear Physics",
      text: `In a nuclear reaction, the $Q$-value is defined as:

$$Q = (m_{\\text{initial}} - m_{\\text{final}})c^2$$`,
      options: JSON.stringify([
        "$(m_{initial} - m_{final})c^2$",
        "$(m_{final} - m_{initial})c^2$",
        "$m_{initial}c^2$",
        "$m_{final}c^2$"
      ]),
      correctAnswer: "A",
      explanation: `The $Q$-value represents the energy released in a nuclear reaction:

$$Q = \\Delta m \\cdot c^2 = (m_{\\text{initial}} - m_{\\text{final}})c^2$$

If $Q > 0$: Exothermic reaction (energy released)
If $Q < 0$: Endothermic reaction (energy absorbed)`,
      imageUrl: null,
      images: null,
    },
    {
      setId: set.id,
      type: "mcq",
      order: 15,
      topic: "Electrochemistry",
      text: `The standard electrode potential of a hydrogen electrode is:

$$E°_{H^+/H_2} = 0.00 \\text{ V}$$ (by convention)`,
      options: JSON.stringify(["$-1.00 \\text{ V}$", "$0.00 \\text{ V}$", "$+1.00 \\text{ V}$", "$+2.00 \\text{ V}$"]),
      correctAnswer: "B",
      explanation: `By international convention:

$$E°_{H^+/H_2} = 0.00 \\text{ V}$$

This is the reference electrode against which all other electrode potentials are measured. The hydrogen electrode consists of:
- $H_2$ gas at 1 atm pressure
- $H^+$ ions at 1 M concentration
- Platinum electrode`,
      imageUrl: null,
      images: null,
    },
  ];

  for (const q of questions) {
    await prisma.question.create({ data: q });
  }

  console.log(`✅ Seeded 1 test set with ${questions.length} questions`);
  console.log(`   - 15 questions total`);
  console.log(`   - Heavy LaTeX math throughout`);
  console.log(`   - 3 questions with images for testing`);
  console.log(`   - kind=INSTITUTE exam=JEE_MAIN tags=["Full Syllabus","Grand Test"]`);

  // Seed a default admin so Batch.createdBy (FK to Admin.email) resolves
  await prisma.admin.upsert({
    where: { email: "seed@testify.app" },
    update: {},
    create: { email: "seed@testify.app", name: "Seed Admin" },
  });

  // Test batch — all 3 demo students are members, JEE set assigned with a wide-open window
  const batch = await prisma.batch.create({
    data: {
      name: "JEE Main 2026 Batch",
      description: "Default cohort for demo students — visible to all seeded users.",
      createdBy: "seed@testify.app",
      isActive: true,
    },
  });
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  for (const u of users) {
    await prisma.batchMember.create({ data: { batchId: batch.id, userId: u.id } });
  }
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  await prisma.batchPaper.create({
    data: {
      batchId: batch.id,
      setId: set.id,
      scheduledStart: now,
      scheduledEnd: thirtyDaysFromNow,
      addedBy: "seed@testify.app",
    },
  });
  console.log(`✅ Seeded batch "${batch.name}" (${users.length} members, 1 paper assigned, live for 30 days)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
