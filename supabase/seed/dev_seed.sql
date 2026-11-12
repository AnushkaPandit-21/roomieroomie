-- =============================================================================
-- RoomieRoomie DEV/TEST SEED — 200 fake profiles across Bengaluru, Pune and Mumbai.
-- NEVER run against production. (D17)
--
-- How test data is kept separate:
--   * Every seed user has auth.users.raw_app_meta_data.seed = true
--   * Seed phone numbers are in the reserved fake range +91 99999 0xxxx
--   * Ids are deterministic (md5 of "roomieroomie-seed-<n>") and photos point to placeholder
--     images (picsum.photos, no real people)
--   * This file is outside supabase/migrations, so `supabase db push` never applies it
--   * supabase/seed/cleanup_seed.sql removes all of it
--
-- Re-runnable: existing seed users are deleted first (cascades to all their rows).
-- Refuses to run if the database looks like production (more than 50 non-seed users).
-- =============================================================================

do $$
declare
  total_profiles constant integer := 200;
  real_users integer;

  bengaluru_areas text[] := array['Koramangala', 'HSR Layout', 'Indiranagar', 'BTM Layout', 'Bellandur', 'Marathahalli',
    'Whitefield', 'Electronic City', 'JP Nagar', 'Jayanagar', 'Hebbal', 'Malleshwaram'];
  pune_areas text[] := array['Kothrud', 'Baner', 'Aundh', 'Viman Nagar', 'Hinjewadi', 'Wakad', 'Kharadi',
    'Koregaon Park', 'Hadapsar', 'Magarpatta', 'Shivajinagar', 'Pimple Saudagar'];
  mumbai_areas text[] := array['Andheri West', 'Andheri East', 'Powai', 'Bandra West', 'Goregaon East', 'Malad West',
    'Lower Parel', 'Dadar', 'Chembur', 'Ghatkopar', 'Santacruz', 'Borivali'];

  female_names text[] := array['Aanya', 'Diya', 'Ishita', 'Kavya', 'Meera', 'Nisha', 'Pooja', 'Riya', 'Sanya', 'Tanvi',
    'Ananya', 'Bhavya', 'Charvi', 'Divya', 'Esha', 'Gauri', 'Harini', 'Janhavi', 'Kritika', 'Lavanya', 'Mahima',
    'Neha', 'Pallavi', 'Radhika', 'Sakshi', 'Shreya', 'Sneha', 'Swati', 'Trisha', 'Vaishnavi', 'Aditi', 'Anjali',
    'Deepika', 'Komal', 'Madhuri', 'Nandini', 'Priya', 'Ritika', 'Sonal', 'Zoya'];
  male_names text[] := array['Aarav', 'Arjun', 'Dev', 'Ishaan', 'Kabir', 'Karan', 'Nikhil', 'Rahul', 'Rohan', 'Siddharth',
    'Aditya', 'Akash', 'Aman', 'Ankit', 'Dhruv', 'Gaurav', 'Harsh', 'Jay', 'Kunal', 'Manish', 'Mohit', 'Pranav',
    'Rajat', 'Sahil', 'Sameer', 'Shaurya', 'Tushar', 'Varun', 'Vikram', 'Yash', 'Abhishek', 'Ayaan', 'Farhan',
    'Imran', 'Naveen', 'Omkar', 'Pratik', 'Ritesh', 'Suresh', 'Vivek'];
  neutral_names text[] := array['Aru', 'Avi', 'Kiran', 'Noor', 'Rumi', 'Sam', 'Shan', 'Tara', 'Neel', 'Ray',
    'Jaya', 'Sasha', 'Rishi', 'Ashu', 'Mani'];

  occupations text[] := array['Software Engineer', 'Product Designer', 'Data Analyst', 'Chartered Accountant',
    'Marketing Executive', 'MBA Student', 'Medical Resident', 'Content Writer', 'UX Researcher', 'Consultant',
    'Sales Manager', 'Teacher', 'Architect', 'Civil Engineer', 'HR Executive', 'Graphic Designer', 'Law Student',
    'Research Scholar', 'Startup Founder', 'Bank Officer'];

  bios text[] := array[
    'New to the city for work. Quiet on weekdays, up for exploring on weekends.',
    'Keep the kitchen clean and we will get along great.',
    'Mostly at office or the gym. Looking for a chill, respectful flatmate.',
    'Love cooking for others. Plants, books and slow mornings.',
    'Final-year student, early riser, happy to split chores fairly.',
    'Remote worker, so I value a calm space during the day.',
    'Big on music and board games. Not big on mess.',
    'Moving cities next month and looking for a friendly home.'];

  prompt_questions text[] := array['My ideal Sunday at home looks like', 'The house rule I will never break',
    'You will find me in the kitchen making', 'My roommate green flag is', 'I am looking for a flatmate who',
    'Weeknights, I am usually', 'My pet peeve at home is', 'Best thing about my neighbourhood'];
  prompt_answers text[] := array[
    'Chai, a long breakfast and zero plans till noon.',
    'Dishes get washed the same day. Always.',
    'Rajma chawal that could convert anyone.',
    'Someone who replaces the milk when they finish it.',
    'Respects quiet hours but is up for the odd movie night.',
    'Winding down with a book after a long day.',
    'Wet towels on the bed.',
    'Great street food five minutes away.',
    'Splitting bills on day one, no awkward reminders.',
    'Trying a new recipe every weekend.',
    'Board games and takeaway with flatmates.',
    'Early morning runs and early nights.'];

  amenity_pool text[] := array['WiFi', 'AC', 'Washing machine', 'Fridge', 'Geyser', 'Power backup', 'Housekeeping',
    'Parking', 'Gym', 'Lift', 'Meals included', 'Balcony'];
  regional_languages text[];

  i integer;
  uid uuid;
  v_city text;
  city_areas text[];
  budget_min integer;
  budget_max integer;
  v_gender public.gender;
  v_name text;
  v_want public.gender[];
  v_show public.gender[];
  v_areas text[];
  v_budget integer;
  v_move_in date;
  v_seeking public.seeking_type;
  v_rent integer;
  r double precision;
  n integer;
  q_order integer[];
  langs text[];
  dealbreakers public.dealbreaker_field[];
  v_food public.food_preference;
  v_smoking public.habit_preference;
  v_drinking public.habit_preference;
  v_sleep public.sleep_schedule;
  v_guests public.guests_preference;
  v_pets public.pets_preference;
begin
  select count(*) into real_users
  from auth.users u
  where coalesce(u.raw_app_meta_data ->> 'seed', 'false') <> 'true';

  if real_users > 50 then
    raise exception 'Refusing to seed: % non-seed users exist. This looks like production.', real_users;
  end if;

  delete from auth.users u where u.raw_app_meta_data ->> 'seed' = 'true';

  perform setseed(0.2026);

  for i in 1..total_profiles loop
    uid := md5('roomieroomie-seed-' || i)::uuid;

    -- 40% Bengaluru, 30% Pune, 30% Mumbai
    if i <= total_profiles * 0.4 then
      v_city := 'Bengaluru'; city_areas := bengaluru_areas; budget_min := 8000; budget_max := 28000;
      regional_languages := array['Kannada', 'Tamil', 'Telugu', 'Malayalam'];
    elsif i <= total_profiles * 0.7 then
      v_city := 'Pune'; city_areas := pune_areas; budget_min := 6000; budget_max := 20000;
      regional_languages := array['Marathi'];
    else
      v_city := 'Mumbai'; city_areas := mumbai_areas; budget_min := 10000; budget_max := 40000;
      regional_languages := array['Marathi', 'Gujarati'];
    end if;

    r := random();
    if r < 0.45 then
      v_gender := 'male'; v_name := male_names[1 + floor(random() * cardinality(male_names))::int];
    elsif r < 0.90 then
      v_gender := 'female'; v_name := female_names[1 + floor(random() * cardinality(female_names))::int];
    else
      v_gender := 'non_binary'; v_name := neutral_names[1 + floor(random() * cardinality(neutral_names))::int];
    end if;

    r := random();
    v_want := case
      when r < 0.65 then array[v_gender]
      when r < 0.85 then array['male', 'female', 'non_binary']::public.gender[]
      else array(select distinct g from unnest(array[v_gender, 'non_binary'::public.gender]) g)
    end;
    r := random();
    v_show := case
      when r < 0.60 then array[v_gender]
      when r < 0.85 then array['male', 'female', 'non_binary']::public.gender[]
      else array(select distinct g from unnest(array[v_gender, 'non_binary'::public.gender]) g)
    end;

    v_areas := array(
      select a from unnest(city_areas) a order by random() limit 1 + floor(random() * 3)::int
    );
    v_budget := (round((budget_min + random() * (budget_max - budget_min)) / 500) * 500)::int;
    v_move_in := current_date + floor(random() * 61)::int;
    v_seeking := case when random() < 0.25 then 'have_place' else 'need_place' end;

    insert into auth.users (
      instance_id, id, aud, role, phone, phone_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      '91999990' || lpad(i::text, 4, '0'), now(),
      '{"provider": "phone", "providers": ["phone"], "seed": true}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', '',
      false, false
    );

    insert into public.profiles (
      id, name, dob, gender, want_genders, show_to_genders, city, areas, max_budget, move_in_date,
      seeking_type, occupation, bio, is_paused, last_active_at
    ) values (
      uid, v_name,
      current_date - make_interval(years => 19 + floor(random() * 16)::int, days => floor(random() * 365)::int),
      v_gender, v_want, v_show, v_city, v_areas, v_budget, v_move_in,
      v_seeking,
      occupations[1 + floor(random() * cardinality(occupations))::int],
      bios[1 + floor(random() * cardinality(bios))::int],
      random() < 0.04,
      now() - make_interval(secs => random() * 10 * 86400)
    );

    -- Lifestyle preferences
    r := random();
    v_food := case when r < 0.40 then 'veg' when r < 0.85 then 'non-veg' else 'egg' end;
    r := random();
    v_smoking := case when r < 0.60 then 'no' when r < 0.88 then 'okay' else 'yes' end;
    r := random();
    v_drinking := case when r < 0.35 then 'no' when r < 0.75 then 'okay' else 'yes' end;
    v_sleep := case when random() < 0.5 then 'early' else 'late' end;
    r := random();
    v_guests := case when r < 0.25 then 'never' when r < 0.80 then 'sometimes' else 'often' end;
    r := random();
    v_pets := case when r < 0.10 then 'has_pets' when r < 0.55 then 'okay' else 'no_pets' end;

    langs := array[]::text[];
    if random() < 0.8 then langs := array_append(langs, 'English'); end if;
    if random() < 0.7 then langs := array_append(langs, 'Hindi'); end if;
    if random() < 0.4 then langs := array_append(langs, regional_languages[1 + floor(random() * cardinality(regional_languages))::int]); end if;
    if cardinality(langs) = 0 then langs := array['English']; end if;

    r := random();
    dealbreakers := case
      when r < 0.62 then array[]::public.dealbreaker_field[]
      when r < 0.92 then array(select f from unnest(enum_range(null::public.dealbreaker_field)) f order by random() limit 1)
      else array(select f from unnest(enum_range(null::public.dealbreaker_field)) f order by random() limit 2)
    end;

    insert into public.preferences (profile_id, food, smoking, drinking, sleep, cleanliness, guests, pets, language, dealbreakers)
    values (uid, v_food, v_smoking, v_drinking, v_sleep, 2 + floor(random() * 4)::int, v_guests, v_pets, langs, dealbreakers);

    -- 3–6 profile photos (placeholder images, no real people)
    n := 3 + floor(random() * 4)::int;
    insert into public.photos (profile_id, url, position, is_room_photo)
    select uid, 'https://picsum.photos/seed/rr-' || left(uid::text, 8) || '-' || k || '/1080/1350', k - 1, false
    from generate_series(1, n) k;

    -- 3 prompts with distinct questions
    q_order := array(select k from generate_series(1, cardinality(prompt_questions)) k order by random() limit 3);
    insert into public.prompts (profile_id, question, answer, position)
    select uid, prompt_questions[q_order[k]], prompt_answers[1 + floor(random() * cardinality(prompt_answers))::int], k
    from generate_series(1, 3) k;

    -- Hosts: one listing + 3 room photos
    if v_seeking = 'have_place' then
      v_rent := greatest(3000, (round(v_budget * (0.6 + random() * 0.4) / 500) * 500)::int);
      insert into public.listings (host_id, area, rent, deposit, available_from, occupancy, furnished, amenities)
      values (
        uid, v_areas[1], v_rent, v_rent * (1 + floor(random() * 3)::int),
        greatest(current_date, v_move_in + floor(random() * 16)::int - 5),
        1 + floor(random() * 3)::int,
        random() < 0.7,
        array(select a from unnest(amenity_pool) a order by random() limit 3 + floor(random() * 4)::int)
      );

      insert into public.photos (profile_id, url, position, is_room_photo)
      select uid, 'https://picsum.photos/seed/rr-room-' || left(uid::text, 8) || '-' || k || '/1080/810', k - 1, true
      from generate_series(1, 3) k;
    end if;
  end loop;

  raise notice 'Seeded % fake profiles (Bengaluru/Pune/Mumbai).', total_profiles;
end;
$$;
