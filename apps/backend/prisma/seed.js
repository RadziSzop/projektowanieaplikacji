import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const products = [
  { id: 1, name: 'Standard', price: 7900, description: 'Wszystko, czego potrzebujesz na dobry początek. Proste narzędzia do codziennej pracy.', features: ['Licencja na 1 urządzenie', 'Podstawowe narzędzia', 'Aktualizacje przez rok', 'Wsparcie e-mail'] },
  { id: 2, name: 'Plus', price: 14900, description: 'Więcej możliwości dla Twoich pomysłów. Dla tych, którzy chcą zrobić krok dalej.', features: ['Licencja na 3 urządzenia', 'Wszystkie funkcje Standard', 'Zaawansowane narzędzia', 'Priorytetowe wsparcie'] },
  { id: 3, name: 'Pro', price: 24900, description: 'Pełna swoboda bez kompromisów. Kompletny zestaw do najbardziej wymagających projektów.', features: ['Licencja na 5 urządzeń', 'Wszystkie funkcje Plus', 'Użytek komercyjny', 'Dożywotnie aktualizacje'] },
];
try {
  for (const product of products) await db.product.upsert({ where: { id: product.id }, update: product, create: product });
  console.log('Dodano 3 przykładowe licencje.');
} finally { await db.$disconnect(); }
