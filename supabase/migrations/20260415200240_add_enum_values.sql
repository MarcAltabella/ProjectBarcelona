-- Add new internal document class enum values for Patient_questionnaire and Info_sheet
ALTER TYPE public.internal_document_class ADD VALUE IF NOT EXISTS 'Patient_questionnaire';
ALTER TYPE public.internal_document_class ADD VALUE IF NOT EXISTS 'Info_sheet';
