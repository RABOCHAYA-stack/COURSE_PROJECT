-- Начальные данные для зоомагазина «Лапа и Дом» (PostgreSQL)

INSERT INTO suppliers (name, contact_person, phone, email, city, lead_time_days, categories, notes)
SELECT * FROM (VALUES
  ('ООО «ЗооПитание Русь»', 'Алексей Морозов', '+7 (495) 612-40-18', 'orders@zoopitanie.ru', 'Москва', 2, '["food","treats"]'::jsonb, 'Основной дистрибьютор сухих кормов холистик и натуральных сушёных лакомств.'),
  ('АО «ВетФарм Групп»', 'Елена Соколова', '+7 (812) 407-89-33', 'b2b@vetpharm-group.ru', 'Санкт-Петербург', 3, '["medicine","care"]'::jsonb, 'Сертифицированные ветпрепараты, пробиотики, витаминные комплексы и дерматологические шампуни.'),
  ('ТД «Лапа и Комфорт»', 'Дмитрий Волков', '+7 (495) 788-25-90', 'supply@lapakomfort.ru', 'Москва', 4, '["supplies","care"]'::jsonb, 'Поставщик льняных лежанок, деревянных когтеточек, керамических мисок и аксессуаров.'),
  ('Питомник «Северный Птичник и Ко»', 'Ирина Белова', '+7 (926) 514-77-04', 'kennel@severbird.ru', 'Подольск', 1, '["animals"]'::jsonb, 'Лицензированный питомник декоративных кроликов, волнистых попугаев, грызунов и аквариумных рыбок.')
) AS v(name, contact_person, phone, email, city, lead_time_days, categories, notes)
WHERE NOT EXISTS (SELECT 1 FROM suppliers LIMIT 1);
