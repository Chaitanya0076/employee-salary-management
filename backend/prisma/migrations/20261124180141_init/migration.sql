-- CreateEnum
CREATE TYPE "Level" AS ENUM ('L1', 'L2', 'L3', 'L4', 'L5', 'L6');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('BASE', 'BONUS', 'ALLOWANCE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HR_MANAGER');

-- CreateTable
CREATE TABLE "fx_rates" (
    "currency" CHAR(3) NOT NULL,
    "rate_to_usd" DECIMAL(18,8) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("currency")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "hire_date" DATE NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "country_code" CHAR(2) NOT NULL,
    "department_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensations" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_components" (
    "id" SERIAL NOT NULL,
    "compensation_id" INTEGER NOT NULL,
    "type" "ComponentType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "compensation_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'HR_MANAGER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_country_code_department_id_level_idx" ON "employees"("country_code", "department_id", "level");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_last_name_first_name_idx" ON "employees"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "compensations_employee_id_effective_from_idx" ON "compensations"("employee_id", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "compensation_components_compensation_id_type_key" ON "compensation_components"("compensation_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_currency_fkey" FOREIGN KEY ("currency") REFERENCES "fx_rates"("currency") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensations" ADD CONSTRAINT "compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_components" ADD CONSTRAINT "compensation_components_compensation_id_fkey" FOREIGN KEY ("compensation_id") REFERENCES "compensations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints and indexes Prisma's schema language cannot express.
-- See docs/data-model.md (business rules R2, R5, R8 and the index plan).
-- Prisma's diff ignores these objects (verified: a follow-up `migrate dev` is empty),
-- but still review future generated migrations for statements touching them.
-- ---------------------------------------------------------------------------

-- Positive money and rates.
ALTER TABLE "compensation_components"
  ADD CONSTRAINT "compensation_components_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "fx_rates"
  ADD CONSTRAINT "fx_rates_rate_positive" CHECK ("rate_to_usd" > 0);

-- R8: a closed period must end after it starts (effective_to is exclusive).
ALTER TABLE "compensations"
  ADD CONSTRAINT "compensations_period_valid"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");

-- R5: at most one current (open-ended) compensation per employee.
-- Also serves as the fast join path from an employee to their current pay.
CREATE UNIQUE INDEX "compensations_one_current_per_employee"
  ON "compensations" ("employee_id")
  WHERE "effective_to" IS NULL;

-- Substring search (q) across name, email and employee code.
-- Queries must use exactly this expression to hit the index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "employees_search_trgm_idx"
  ON "employees"
  USING GIN (lower("first_name" || ' ' || "last_name" || ' ' || "email" || ' ' || "employee_code") gin_trgm_ops);
