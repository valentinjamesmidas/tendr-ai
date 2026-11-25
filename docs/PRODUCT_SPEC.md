# Product scope

tendr.ai is a bid-preparation service for small Czech businesses and sole traders pursuing public contracts. The service costs CZK 9,999 per bid without a success fee or percentage commission. VAT treatment is pending.

## Service workflow

1. The supplier enters only the NEN tender number. The analysis resolves the parameters and public files through an authorized source. Missing or inaccessible parts are flagged for review.
2. The preparation workflow tracks the submission deadline and any published clarification or amendment. It builds a requirements matrix with document, version, locator and supporting quotation.
3. The workflow prepares a cover sheet, applicable declarations, a reference list and JEO inputs where required, using the contracting authority's prescribed forms when available. The package includes a completeness checklist.
4. A procurement specialist checks the package and resolves or flags missing evidence, conflicting requirements and form issues before written handoff. The supplier supplies the bid price and supporting proofs, signs and submits the bid.

## Demo and production

The demo uses synthetic construction and IT documents, simulated payment and a simulated review. The requirements matrix links to its sources. After review, the supplier can edit the example forms and export the package as Markdown or through browser print. The NEN pilot uses a separate single-number route and displays prioritized requirements, practical impacts, actions, evidence, and incomplete document coverage. It requires a verified machine-data source before it can process live tenders.

Production requires verified NEN and E-ZAK ingestion and change monitoring, tenant-isolated handling of supplier documents, written intake and handoff, an authenticated specialist review step tied to the reviewed package version, and transactional billing. See the implementation backlog for the underlying production gates. The service scope excludes legal opinions and automated submission.
