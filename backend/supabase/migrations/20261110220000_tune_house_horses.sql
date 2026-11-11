-- The house seed after the first 3 real races (6, 7 and 18). The total stays 20, so the seed stays 2,000 Oats per market.
-- Luna Sprint was third in each race. Dark Matter and Open Range opened 0 to 2 locks.
update public.horses set seed_weight = 3 where id = 'h5';
update public.horses set seed_weight = 2 where id in ('h3', 'h6');

-- Dark Matter made only 5 to 9 steps in 3 minutes and opened no lock. A low reasoning effort gives it more steps.
update public.horses set reasoning_effort = 'low' where id = 'h3';
