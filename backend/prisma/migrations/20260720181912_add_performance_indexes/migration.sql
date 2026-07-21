-- CreateIndex
CREATE INDEX "Persona_cuit_idx" ON "Persona"("cuit");

-- CreateIndex
CREATE INDEX "Persona_name_idx" ON "Persona"("name");

-- CreateIndex
CREATE INDEX "Persona_isActive_idx" ON "Persona"("isActive");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
