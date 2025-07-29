-- Create apartments table
CREATE TABLE public.apartments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create apartment_members table for many-to-many relationship
CREATE TABLE public.apartment_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apartment_id UUID REFERENCES public.apartments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(apartment_id, user_id)
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apartment_id UUID REFERENCES public.apartments(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  paid_by UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense_splits table to track who owes what for each expense
CREATE TABLE public.expense_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  UNIQUE(expense_id, user_id)
);

-- Create settlements table to track when people settle up
CREATE TABLE public.settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apartment_id UUID REFERENCES public.apartments(id) ON DELETE CASCADE NOT NULL,
  from_user UUID REFERENCES auth.users(id) NOT NULL,
  to_user UUID REFERENCES auth.users(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user profiles table for additional user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for apartments
CREATE POLICY "Users can view apartments they are members of"
ON public.apartments FOR SELECT
USING (
  id IN (
    SELECT apartment_id FROM public.apartment_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create apartments"
ON public.apartments FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Apartment creators can update their apartments"
ON public.apartments FOR UPDATE
USING (auth.uid() = created_by);

-- RLS Policies for apartment_members
CREATE POLICY "Users can view members of their apartments"
ON public.apartment_members FOR SELECT
USING (
  apartment_id IN (
    SELECT apartment_id FROM public.apartment_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can join apartments"
ON public.apartment_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave apartments"
ON public.apartment_members FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses in their apartments"
ON public.expenses FOR SELECT
USING (
  apartment_id IN (
    SELECT apartment_id FROM public.apartment_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Apartment members can create expenses"
ON public.expenses FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  apartment_id IN (
    SELECT apartment_id FROM public.apartment_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Expense creators can update their expenses"
ON public.expenses FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Expense creators can delete their expenses"
ON public.expenses FOR DELETE
USING (auth.uid() = created_by);

-- RLS Policies for expense_splits
CREATE POLICY "Users can view splits for expenses in their apartments"
ON public.expense_splits FOR SELECT
USING (
  expense_id IN (
    SELECT id FROM public.expenses
    WHERE apartment_id IN (
      SELECT apartment_id FROM public.apartment_members 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage splits for their created expenses"
ON public.expense_splits FOR ALL
USING (
  expense_id IN (
    SELECT id FROM public.expenses
    WHERE created_by = auth.uid()
  )
);

-- RLS Policies for settlements
CREATE POLICY "Users can view settlements in their apartments"
ON public.settlements FOR SELECT
USING (
  apartment_id IN (
    SELECT apartment_id FROM public.apartment_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create settlements in their apartments"
ON public.settlements FOR INSERT
WITH CHECK (
  auth.uid() = from_user AND
  apartment_id IN (
    SELECT apartment_id FROM public.apartment_members 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_apartments_updated_at
  BEFORE UPDATE ON public.apartments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate unique apartment codes
CREATE OR REPLACE FUNCTION public.generate_apartment_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 6 character code with letters and numbers
    code := UPPER(
      CHR(65 + (RANDOM() * 25)::INT) ||
      CHR(65 + (RANDOM() * 25)::INT) ||
      (RANDOM() * 9)::INT ||
      (RANDOM() * 9)::INT ||
      CHR(65 + (RANDOM() * 25)::INT) ||
      (RANDOM() * 9)::INT
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.apartments WHERE code = code) INTO exists;
    
    -- Exit loop if code is unique
    IF NOT exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;