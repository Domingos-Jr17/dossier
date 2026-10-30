// emprego.co.mz's and Kukwira's pages, cut down to what the adapters read
// (markup as served in October 2026, unquoted attributes included).

/** A search: list rows with a closing date or "Expirado", and a next page. */
export const empregoMzSearchPage = `<!doctype html><html><head>
<link rel=next href=https://www.emprego.co.mz/pesquisa/gestao/page/2/ >
</head><body><div class="content-display top-14p clearfix"><ul>
<li class=clearfix><div class="col-65-10 right-m-3p left bold"><h3 class="normal-text"> <a href=https://www.emprego.co.mz/vaga/chef-de-cozinha-2/ title="Recrutamento na PRI"> Chef de Cozinha </a></h3><h4 class="lowlight ellipsis-text"> Recrutamento na PRI, para a vaga de Chef de Cozinha, em Maputo - Moçambique.</h4> <span class=lowlight> <a href=https://www.emprego.co.mz/empregador/pri-precision-recruitment-international/ class=companylink> PRI &#8211; Precision Recruitment International </a> </span></div><div class="col-15-10 right-m-3p left lowlight"> <a href=https://www.emprego.co.mz/cidade/maputo/ rel=tag>Maputo</a></div><div class="col-1-7 left lowlight"> 23.11.2026</div> </li>
<li class=clearfix><div class="col-65-10 right-m-3p left bold"><h3 class="normal-text"> <a href=https://www.emprego.co.mz/vaga/engenheiro-civil-a2a/ title="A A2A está a recrutar"> Engenheiro Civil </a></h3><h4 class="lowlight ellipsis-text"> A A2A está a recrutar um Engenheiro Civil, para Maputo.</h4> <span class=lowlight> <a href=https://www.emprego.co.mz/empregador/a2a-engenheirosconstrutores/ class=companylink> A2A Engenheiros&#038;Construtores </a> </span></div><div class="col-15-10 right-m-3p left lowlight"> <a href=https://www.emprego.co.mz/cidade/maputo/ rel=tag>Maputo</a></div><div class="col-1-7 left lowlight"> Expirado</div> </li>
<li class=clearfix><div class="col-65-10 right-m-3p left bold"><h3 class="normal-text"> <a href=https://www.emprego.co.mz/vaga/contabilista-senior/ title="Banco Exemplo"> Contabilista Sénior </a></h3><h4 class="lowlight ellipsis-text"> O Banco Exemplo está a recrutar um Contabilista Sénior, para Nampula.</h4> <span class=lowlight> <a href=https://www.emprego.co.mz/empregador/banco-exemplo/ class=companylink> Banco Exemplo </a> </span></div><div class="col-15-10 right-m-3p left lowlight"> <a href=https://www.emprego.co.mz/cidade/nampula/ rel=tag>Nampula</a></div><div class="col-1-7 left lowlight"> 01.12.2026</div> </li>
</ul></div></body></html>`;

/** A city page: a featured row (no closing date), then a list row. */
export const empregoMzCityPage = `<!doctype html><html><head></head><body><ul>
<li><h3 class="bold medium-text ellipsis-text"> <a href=https://www.emprego.co.mz/vaga/human-resources-assistant-support/ title="Human Resources Assistant (Support)"> Human Resources Assistant (Support) </a></h3><h4 class="short-description-hidden lowlight ellipsis-text"> The U.S. Embassy is hiring a Human Resources Assistant (Support), in Maputo, Mozambique.</h4> <span class=company> <a href=https://www.emprego.co.mz/empregador/embaixada-dos-estados-unidos-da-america/ title="Ver todas as vagas de Embaixada dos Estados Unidos da América"> <span>Embaixada dos Estados Unidos da América</span> </a> </span> <span class=location> para <a href=https://www.emprego.co.mz/cidade/maputo/ rel=tag>Maputo</a> </span> <span class="short-description-hidden lowlight ellipsis-text"> Categorias <a href=https://www.emprego.co.mz/categoria/recursos-humanos-e-recrutamento/ rel=tag>Recursos Humanos e Recrutamento</a> </span> </li>
<li class=clearfix><div class="col-65-10 right-m-3p left bold"><h3 class="normal-text"> <a href=https://www.emprego.co.mz/vaga/chef-de-cozinha-2/ title="Recrutamento na PRI"> Chef de Cozinha </a></h3><h4 class="lowlight ellipsis-text"> Recrutamento na PRI.</h4> <span class=lowlight> <a href=https://www.emprego.co.mz/empregador/pri-precision-recruitment-international/ class=companylink> PRI &#8211; Precision Recruitment International </a> </span></div><div class="col-15-10 right-m-3p left lowlight"> <a href=https://www.emprego.co.mz/categoria/gastronomia-e-restauracao/ rel=tag>Gastronomia e Restauração</a></div><div class="col-1-7 left lowlight"> 23.11.2026</div> </li>
</ul></body></html>`;

/** The front page: a grid of cards, the logo linking to the posting too, no next page. */
export const empregoMzFrontPage = `<!doctype html><html><head></head><body><ul>
<li id=thumbpost-50407 class=grid-list-el><div class=grid-item> <a class=grid-logo href=https://www.emprego.co.mz/vaga/agronomist/ title="Ver a Vaga: Agronomist - Heading Moçambique" target=_blank><div class=grid-logo-layer></div></a> <span class=flag>EN</span></div><div class="grid-item-meta new-vacancy">Novo</div><div class=grid-info><h3> <a href=https://www.emprego.co.mz/vaga/agronomist/ target=_blank>Agronomist</a></h3><h4 class="short-description-hidden lowlight ellipsis-text">Heading is hiring an Agronomist, in Maputo, Mozambique.</h4> <a class="company ellipsis-text" href=https://www.emprego.co.mz/empregador/heading/ title="Ver todas as vagas de Heading Moçambique"> Heading Moçambique </a> <span class=location> <a href=https://www.emprego.co.mz/cidade/maputo/ rel=tag>Maputo</a> <span class=jobcount></span> </span></div></li>
</ul></body></html>`;

/** A posting's page: a one-line JobPosting summary, the full text, and how to apply. */
export const empregoMzPosting = `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"http://schema.org","@type":"JobPosting","title":"Agronomist","description":"Heading is hiring an Agronomist, in Maputo, Mozambique."}</script>
</head><body><nav>Menu</nav><div class="content-col-1-2 adjust content-vacancy left right-24m border-top top-20p"><h2 class="page-small-title">Vaga</h2><h1 class="h3">Agronomist</h1><h3 class="h4">Heading Moçambique</h3><div class=medium-large-text> Heading is recruiting an Agronomist, to be based in Maputo, Mozambique.<h6>Duties</h6><ul> <li>Identify, select and test the seeds required for the vegetable oil production initiatives (bio feedstock)</li> <li>Evaluate, identify and select the best cultivation systems and cycles for bio feedstock production</li></ul></div><div></div><div class="how-to-apply-section hidden"><h6> <b>Como se Candidatar</b></h6><ul> <li><div class=needs-logout> Via employer's website <a href="https://www.emprego.co.mz/candidato/vaga/?vacancy_id=50001" class=filter-login>Login</a></div><div class=needs-login> Via employer's website <a href="https://bit.ly/agronomist-maputo" target=_blank>https://bit.ly/agronomist-maputo</a></div></li></ul></div></div><footer>Rodapé</footer></body></html>`;

// Kukwira's fragments, cut down (markup as served in October 2026).

/** /partials/oportunidades.php: one card per opening, its text cut short. */
export const kukwiraOpenings = `<div ng-controller="oportunidadesController" ng-init="initialize()"><section><div class="container"><div class="row">
<h3 class="text-center p-bottom-20 section-title">OFERTAS DE EMPREGO</h3>
<div class="bg-orange-light p-20">
<h5 class="text-center"><span class="text_bold">Cargo </span>Chefe de Secção de Trade - Banca Transaccional</h5>
<p><span class="text_bold">Descrição:</span>  • Desenvolver estratégias de produtos e vendas;
• Identificar oportunidades de venda cruzada (cross-selling) e venda incrementa...</p>
<p><span class="text_bold">Requisitos-:</span> •  Licenciatura em Gestão, Finanças, Economia ou áreas afins;
•  Mínimo de 5 anos de experiência na área de Banca...</p>
<a href="#/info#500" class="btn button-orange-full-width text-uppercase">+ Info</a>
<a href="#/candidatura#500" class="btn button-orange-full-width text-uppercase">CANDIDATAR-SE</a>
</div>
<div class="bg-orange-light p-20">
<h5 class="text-center"><span class="text_bold">Cargo </span>Técnico de Manutenção</h5>
<p><span class="text_bold">Descrição:</span> • Manutenção preventiva de geradores</p>
<a href="#/info#501" class="btn button-orange-full-width text-uppercase">+ Info</a>
</div>
</div></div></section></div>`;

/** /endpoints/info_endpoint.php?process_id=500: the opening's whole text. */
export const kukwiraInfo = `<h5 class="text-center p-bottom-20 section-title"></h5>
<h5 class="text-center"><span class="text_bold">Cargo: </span>Chefe de Secção de Trade - Banca Transaccional</h5>
<p><span class="text_bold"></span> </p>
<p><span class="text_bold">Descrição:</span>  • Desenvolver estratégias de produtos e vendas;
• Identificar oportunidades de venda cruzada (cross-selling) e venda incremental de produtos e serviços;
</p>
<p><span class="text_bold">Requisitos:</span> •  Licenciatura em Gestão, Finanças, Economia ou áreas afins;
•  Fluência em Português e Inglês;
</p>
<div class="row p-top-20 col-lg-12"><a href="#/oportunidades" class="btn">Voltar</a><a href="#/candidatura#500" class="btn">CANDIDATAR-SE</a></div>`;
