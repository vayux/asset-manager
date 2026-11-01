
CREATE TYPE public.enum_assets_category AS ENUM (
    'cash',
    'real_estate',
    'vehicle',
    'business',
    'collectible',
    'stocks',
    'gadgets',
    'other'
);

CREATE TYPE public.enum_budget_categories_framework_tag AS ENUM (
    'need',
    'want',
    'saving'
);

CREATE TYPE public.enum_goals_scope AS ENUM (
    'investments',
    'net_worth'
);

CREATE TYPE public.enum_incomes_frequency AS ENUM (
    'once',
    'weekly',
    'biweekly',
    'monthly'
);

CREATE TYPE public.enum_investments_category AS ENUM (
    'bank_account',
    'fixed_deposit',
    'recurring_deposit',
    'stocks',
    'mutual_funds',
    'provident_fund',
    'insurance',
    'gold',
    'real_estate',
    'crypto',
    'personal_loan',
    'other'
);

CREATE TYPE public.enum_liabilities_category AS ENUM (
    'loan',
    'credit_card',
    'mortgage',
    'tax',
    'other'
);

CREATE TABLE public.asset_valuations (
    id uuid NOT NULL,
    asset_id uuid NOT NULL,
    valuation_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.assets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    category public.enum_assets_category DEFAULT 'other'::public.enum_assets_category NOT NULL,
    current_value numeric(15,2) DEFAULT 0 NOT NULL,
    purchase_date date,
    depreciation_rate numeric(5,2),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.budget_categories (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    framework_tag public.enum_budget_categories_framework_tag DEFAULT 'need'::public.enum_budget_categories_framework_tag NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.budget_entries (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid NOT NULL,
    month date NOT NULL,
    budgeted_amount numeric(12,2) NOT NULL,
    spent_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.goals (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    target_amount numeric(12,2) NOT NULL,
    target_date date NOT NULL,
    current_amount numeric(12,2) DEFAULT 0 NOT NULL,
    monthly_contribution numeric(12,2) DEFAULT 0 NOT NULL,
    scope public.enum_goals_scope DEFAULT 'investments'::public.enum_goals_scope NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.incomes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    frequency public.enum_incomes_frequency DEFAULT 'monthly'::public.enum_incomes_frequency NOT NULL,
    next_pay_date date NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.investment_histories (
    id uuid NOT NULL,
    investment_id uuid NOT NULL,
    valuation_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.investments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    category public.enum_investments_category NOT NULL,
    sub_category character varying(255),
    current_amount numeric(15,2) DEFAULT 0 NOT NULL,
    initial_amount numeric(15,2),
    interest_rate numeric(5,2),
    maturity_date timestamp with time zone,
    account_number character varying(255),
    institution_name character varying(255),
    description text,
    is_active boolean DEFAULT true,
    investment_date date,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.liabilities (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    category public.enum_liabilities_category DEFAULT 'other'::public.enum_liabilities_category NOT NULL,
    outstanding_amount numeric(15,2) DEFAULT 0 NOT NULL,
    interest_rate numeric(5,2),
    due_date date,
    description text,
    asset_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.portfolio_snapshots (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    total_value numeric(15,2) DEFAULT 0 NOT NULL,
    category_breakdown jsonb,
    investments jsonb,
    notes text,
    is_manual boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    mfa_enabled boolean DEFAULT false,
    mfa_secret character varying(255),
    backup_codes json,
    email_otp_secret character varying(255),
    email_otp_expiry timestamp with time zone,
    email_notifications boolean DEFAULT true,
    security_alerts boolean DEFAULT true,
    investment_updates boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE ONLY public.asset_valuations
    ADD CONSTRAINT asset_valuations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.budget_entries
    ADD CONSTRAINT budget_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.investment_histories
    ADD CONSTRAINT investment_histories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX asset_valuations_asset_id ON public.asset_valuations USING btree (asset_id);

CREATE INDEX asset_valuations_valuation_date ON public.asset_valuations USING btree (valuation_date);

CREATE INDEX investment_histories_investment_id ON public.investment_histories USING btree (investment_id);

CREATE INDEX investment_histories_valuation_date ON public.investment_histories USING btree (valuation_date);

ALTER TABLE ONLY public.asset_valuations
    ADD CONSTRAINT asset_valuations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.budget_entries
    ADD CONSTRAINT budget_entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.budget_categories(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.budget_entries
    ADD CONSTRAINT budget_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.investment_histories
    ADD CONSTRAINT investment_histories_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

