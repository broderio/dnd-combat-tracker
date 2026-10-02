import { getCharacterFeatures, resolveChoiceOptions, setBuildSelection, setBuildSpell } from '/shared/characterBuilder.js';

const BROWSE_PAGE_SIZE = 20;
const BROWSE_CATEGORIES = [
  ['classes', 'Classes'],
  ['subclasses', 'Subclasses'],
  ['species', 'Species'],
  ['backgrounds', 'Backgrounds'],
  ['feats', 'Feats'],
  ['spells', 'Spells'],
  ['equipment', 'Equipment'],
];

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function sourceLabel(record) {
  return [...new Set((record?.sources || [])
    .map((source) => source.publication || source.title || source.id)
    .filter(Boolean))].join(' · ');
}

function itemId(item) {
  return String(item?.id || '').trim();
}

function itemDescription(record) {
  if (!record) return '';
  if (typeof record.description === 'string') return record.description;
  if (typeof record.traits?.map === 'function') return record.traits.map((trait) => `${trait.name}: ${trait.description}`).join('\n\n');
  if (record.featuresByLevel) return Object.entries(record.featuresByLevel)
    .flatMap(([level, features]) => (features || []).map((feature) => `Level ${level} · ${feature.name}: ${feature.description}`))
    .join('\n\n');
  return '';
}

export class CharacterBuilderPanel {
  constructor(root, { repository, getBuild, onBuildChange, onUseItem, getCharacterLevel, getLegacyClassName, getCharacterData }) {
    this.root = root;
    this.repository = repository;
    this.getBuild = getBuild;
    this.onBuildChange = onBuildChange;
    this.onUseItem = onUseItem;
    this.getCharacterLevel = getCharacterLevel;
    this.getLegacyClassName = getLegacyClassName || (() => '');
    this.getCharacterData = getCharacterData || (() => ({}));
    this.manifest = null;
    this.catalogs = new Map();
    this.activeCategory = 'classes';
    this.searchText = '';
    this.page = 0;
    this.selectedClass = null;
    this.selectedSubclass = null;
    this.selectedRecord = null;
    this.spellStatus = 'known';
    this.init();
  }

  init() {
    this.root.replaceChildren();
    this.root.className = 'cf-rule-builder';
    this.root.append(createElement('h3', '', 'Rules-backed builder'));
    this.root.append(createElement('p', 'hint', 'Browse the local rules database, inspect each option, and select it for this character. Catalog results are paginated so the complete list remains discoverable.'));

    const browseHeading = createElement('h4', 'cf-builder-browse-heading', 'Browse all options');
    this.root.append(browseHeading);
    const exportActions = createElement('div', 'cf-builder-controls cf-builder-export');
    const jsonButton = createElement('button', 'secondary-btn', 'Export JSON');
    jsonButton.type = 'button';
    jsonButton.addEventListener('click', () => this.exportJson());
    const printButton = createElement('button', 'secondary-btn', 'Print / Save PDF');
    printButton.type = 'button';
    printButton.addEventListener('click', () => globalThis.print());
    exportActions.append(jsonButton, printButton);
    this.root.append(exportActions);
    const controls = createElement('div', 'cf-builder-controls cf-builder-browse-controls');
    this.categorySelect = document.createElement('select');
    this.categorySelect.setAttribute('aria-label', 'Option category');
    BROWSE_CATEGORIES.forEach(([value, label]) => this.categorySelect.add(new Option(label, value)));
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = 'Search this category';
    this.searchInput.setAttribute('aria-label', 'Search options');
    controls.append(this.categorySelect, this.searchInput);
    this.root.append(controls);

    this.resultCount = createElement('p', 'cf-builder-count cf-builder-browse-count', 'Loading local rules…');
    this.resultList = createElement('div', 'cf-builder-results cf-builder-browse-results');
    const pager = createElement('div', 'cf-builder-pager cf-builder-browse-pager');
    this.previousButton = createElement('button', 'secondary-btn', 'Previous');
    this.previousButton.type = 'button';
    this.pageLabel = createElement('span', '', 'Page 1');
    this.nextButton = createElement('button', 'secondary-btn', 'Next');
    this.nextButton.type = 'button';
    pager.append(this.previousButton, this.pageLabel, this.nextButton);
    this.root.append(this.resultCount, this.resultList, pager);

    this.detail = createElement('article', 'cf-builder-detail');
    this.root.append(this.detail);

    this.classSection = createElement('section', 'cf-builder-class-section');
    this.classSection.append(createElement('h4', '', 'Class progression and choices'));
    this.classControls = createElement('div', 'cf-builder-controls');
    this.classSelect = document.createElement('select');
    this.classSelect.setAttribute('aria-label', 'Character class');
    this.subclassSelect = document.createElement('select');
    this.subclassSelect.setAttribute('aria-label', 'Subclass');
    this.subclassSelect.add(new Option('Choose a subclass', ''));
    this.classControls.append(this.classSelect, this.subclassSelect);
    this.classSection.append(this.classControls);
    this.featureList = createElement('div', 'cf-builder-features');
    this.choiceList = createElement('div', 'cf-builder-choices');
    this.classSection.append(this.featureList, this.choiceList);
    this.root.append(this.classSection);

    this.categorySelect.addEventListener('change', () => {
      this.activeCategory = this.categorySelect.value;
      this.searchText = '';
      this.searchInput.value = '';
      this.page = 0;
      this.loadBrowseResults();
    });
    this.searchInput.addEventListener('input', () => {
      this.searchText = this.searchInput.value.trim().toLocaleLowerCase();
      this.page = 0;
      this.loadBrowseResults();
    });
    this.previousButton.addEventListener('click', () => {
      this.page = Math.max(0, this.page - 1);
      this.loadBrowseResults();
    });
    this.nextButton.addEventListener('click', () => {
      this.page += 1;
      this.loadBrowseResults();
    });
    this.classSelect.addEventListener('change', () => this.selectClass(this.classSelect.value));
    this.subclassSelect.addEventListener('change', () => this.selectSubclass(this.subclassSelect.value));
    document.getElementById('cf-level')?.addEventListener('change', () => this.renderProgression());

    this.loadInitialData().catch((error) => {
      this.resultCount.textContent = `Could not load the local rules database: ${error.message}`;
    });
  }

  async loadInitialData() {
    this.manifest = await this.repository.getManifest();
    this.classSelect.replaceChildren(new Option('Choose a class', ''));
    this.manifest.classes.forEach((entry) => this.classSelect.add(new Option(entry.name, entry.id)));
    const buildClass = this.getBuild()?.classes?.[0];
    const legacyName = this.getLegacyClassName().trim().toLocaleLowerCase();
    const fallbackClass = buildClass?.classId || null;
    const classFromCatalog = this.manifest.classes.find((entry) => entry.id === fallbackClass)
      || this.manifest.classes.find((entry) => entry.name.toLocaleLowerCase() === legacyName);
    if (classFromCatalog) {
      this.classSelect.value = classFromCatalog.id;
      await this.selectClass(classFromCatalog.id, { updateBuild: false, subclassId: buildClass.subclassId });
    }
    this.loadBrowseResults();
  }

  async syncFromBuild() {
    if (!this.manifest) this.manifest = await this.repository.getManifest();
    const buildClass = this.getBuild()?.classes?.[0];
    const legacyName = this.getLegacyClassName().trim().toLocaleLowerCase();
    const entry = this.manifest.classes.find((candidate) => candidate.id === buildClass?.classId)
      || this.manifest.classes.find((candidate) => candidate.name.toLocaleLowerCase() === legacyName);
    if (!entry) return;
    this.classSelect.value = entry.id;
    await this.selectClass(entry.id, { updateBuild: false, subclassId: buildClass?.subclassId || null });
  }

  async getCatalogItems(category) {
    if (this.catalogs.has(category)) return this.catalogs.get(category);
    if (category === 'classes') return this.manifest.classes;
    if (category === 'subclasses') {
      const items = this.manifest.classes.flatMap((classEntry) =>
        (classEntry.subclasses || []).map((subclass) => ({ ...subclass, classId: classEntry.id, className: classEntry.name }))
      );
      this.catalogs.set(category, items);
      return items;
    }
    const catalog = await this.repository.getCatalog(category);
    this.catalogs.set(category, catalog.items);
    return catalog.items;
  }

  async loadBrowseResults() {
    try {
      const items = await this.getCatalogItems(this.activeCategory);
      const filtered = items.filter((item) => !this.searchText ||
        `${item.name} ${item.category || ''} ${item.publications?.join(' ') || ''} ${item.className || ''}`.toLocaleLowerCase().includes(this.searchText));
      const pageCount = Math.max(1, Math.ceil(filtered.length / BROWSE_PAGE_SIZE));
      this.page = Math.min(this.page, pageCount - 1);
      const pageItems = filtered.slice(this.page * BROWSE_PAGE_SIZE, (this.page + 1) * BROWSE_PAGE_SIZE);
      this.resultCount.textContent = `${filtered.length} option${filtered.length === 1 ? '' : 's'} · ${items.length} total in ${this.categorySelect.selectedOptions[0]?.textContent || this.activeCategory}`;
      this.pageLabel.textContent = `Page ${this.page + 1} of ${pageCount}`;
      this.previousButton.disabled = this.page === 0;
      this.nextButton.disabled = this.page + 1 >= pageCount;
      this.resultList.replaceChildren();
      pageItems.forEach((item) => {
        const row = createElement('div', 'cf-builder-result');
        const label = item.className ? `${item.name} · ${item.className}` : item.name;
        const showButton = createElement('button', 'cf-builder-item', label);
        showButton.type = 'button';
        showButton.addEventListener('click', () => this.showItem(this.activeCategory, item));
        row.append(showButton);
        this.resultList.append(row);
      });
      if (!filtered.length) this.resultList.append(createElement('p', 'hint', 'No matching options. Clear the search to browse the full list.'));
    } catch (error) {
      this.resultCount.textContent = `Could not load options: ${error.message}`;
    }
  }

  async showItem(category, item) {
    this.selectedRecord = item;
    let record = item;
    try {
      if (category === 'classes') record = await this.repository.getClass(item.id) || item;
      else if (category === 'subclasses') record = await this.repository.getSubclass(item.classId, item.id) || item;
      else if (['species', 'backgrounds', 'feats', 'spells', 'equipment'].includes(category)) {
        record = await this.repository.getCatalogRecord(category, item.id) || item;
      }
    } catch {
      // Keep the catalog summary available when a detail record cannot be read.
    }

    this.detail.replaceChildren();
    this.detail.append(createElement('h4', '', item.className ? `${item.name} · ${item.className}` : item.name));
    const metadata = [
      item.level !== undefined ? (Number(item.level) === 0 ? 'Cantrip' : `Level ${item.level} spell`) : null,
      item.school,
      item.category,
      sourceLabel(record) || item.publications?.join(', '),
    ].filter(Boolean).join(' · ');
    if (metadata) this.detail.append(createElement('p', 'cf-builder-meta', metadata));
    const description = itemDescription(record);
    if (description) {
      const body = createElement('p', 'cf-builder-description', description);
      this.detail.append(body);
    }
    if (category === 'spells') {
      const statusLabel = createElement('label', 'cf-builder-spell-status', 'Spell state ');
      const status = document.createElement('select');
      status.setAttribute('aria-label', 'Spell state');
      [
        ['known', 'Known'],
        ['prepared', 'Prepared'],
        ['always-prepared', 'Always prepared'],
      ].forEach(([value, label]) => status.add(new Option(label, value)));
      status.value = this.getBuild()?.spells?.find((spell) => spell.spellId === item.id)?.status || 'known';
      status.addEventListener('change', () => { this.spellStatus = status.value; });
      this.spellStatus = status.value;
      statusLabel.append(status);
      this.detail.append(statusLabel);
    }
    const useButton = createElement('button', 'primary-btn', this.useLabel(category));
    useButton.type = 'button';
    useButton.addEventListener('click', () => this.useItem(category, item, record));
    this.detail.append(useButton);
  }

  useLabel(category) {
    return ({ classes: 'Use class', subclasses: 'Choose subclass', species: 'Choose species', backgrounds: 'Choose background', feats: 'Add feat', spells: 'Add spell to sheet', equipment: 'Add to inventory' })[category] || 'Select';
  }

  async useItem(category, item, record) {
    const build = structuredClone(this.getBuild() || {});
    if (category === 'classes') {
      this.classSelect.value = item.id;
      await this.selectClass(item.id);
      this.onUseItem?.(category, item, record);
      return;
    }
    if (category === 'subclasses') {
      if (item.classId !== this.selectedClass?.id) await this.selectClass(item.classId);
      this.subclassSelect.value = item.id;
      this.selectSubclass(item.id);
      this.onUseItem?.(category, item, record);
      return;
    }
    if (category === 'species') build.speciesId = item.id;
    else if (category === 'backgrounds') build.backgroundId = item.id;
    else if (category === 'spells') {
      Object.assign(build, setBuildSpell(build, item, { status: this.spellStatus, sourceClassId: this.selectedClass?.id || null }));
    }
    else if (category === 'feats') build.selections = setBuildSelection(build, 'builder:feats', [
      ...(build.selections?.find((selection) => selection.choiceId === 'builder:feats')?.selectedOptionIds || []), item.id,
    ]).selections;
    else if (category === 'equipment') {
      const inventory = Array.isArray(build.inventory) ? [...build.inventory] : [];
      const existing = inventory.find((entry) => entry.equipmentId === item.id);
      if (existing) existing.quantity = Math.min(999, existing.quantity + 1);
      else inventory.push({ equipmentId: item.id, quantity: 1, equipped: false, notes: '' });
      build.inventory = inventory;
    }
    this.onBuildChange(build);
    this.onUseItem?.(category, item, record);
  }

  exportJson() {
    const payload = {
      format: 'dnd-tracker-character-build',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      character: {
        name: document.getElementById('cf-name')?.value.trim() || 'Unnamed',
        class: document.getElementById('cf-class')?.value.trim() || '',
        race: document.getElementById('cf-race')?.value.trim() || '',
        level: Number(this.getCharacterLevel()) || 1,
        ac: Number(document.getElementById('cf-ac')?.value) || 0,
        hp: {
          current: Number(document.getElementById('cf-hp-current')?.value) || 0,
          max: Number(document.getElementById('cf-hp-max')?.value) || 0,
        },
        abilityScores: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => [
          key,
          Number(document.getElementById(`cf-${key}`)?.value) || 10,
        ])),
        tokenColor: document.getElementById('cf-token-color')?.value || '#e63946',
        notes: document.getElementById('cf-notes')?.value || '',
        ...this.getCharacterData(),
        build: this.getBuild() || {},
      },
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${payload.character.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-') || 'character'}-build.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async selectClass(classId, { updateBuild = true, subclassId = null } = {}) {
    this.selectedClass = this.manifest?.classes.find((entry) => entry.id === classId) || null;
    this.selectedSubclass = null;
    this.subclassSelect.replaceChildren(new Option('Choose a subclass', ''));
    (this.selectedClass?.subclasses || []).forEach((entry) => this.subclassSelect.add(new Option(entry.name, entry.id)));
    this.subclassSelect.value = subclassId || '';
    const build = structuredClone(this.getBuild() || {});
    if (updateBuild && this.selectedClass) {
      const classes = Array.isArray(build.classes) ? [...build.classes] : [];
      const first = classes[0] || { classId: this.selectedClass.id, classLevel: this.getCharacterLevel(), subclassId: null };
      const previousClassId = first.classId;
      first.classId = this.selectedClass.id;
      first.classLevel = this.getCharacterLevel();
      first.subclassId = subclassId || (previousClassId === this.selectedClass.id ? first.subclassId : null);
      build.classes = [first, ...classes.slice(1)];
      this.onBuildChange(build);
    }
    if (subclassId) await this.selectSubclass(subclassId, { updateBuild });
    await this.renderProgression();
  }

  async selectSubclass(subclassId, { updateBuild = true } = {}) {
    this.selectedSubclass = null;
    if (subclassId && this.selectedClass) {
      this.selectedSubclass = await this.repository.getSubclass(this.selectedClass.id, subclassId);
    }
    if (updateBuild) {
      const build = structuredClone(this.getBuild() || {});
      if (build.classes?.[0]) build.classes[0].subclassId = subclassId || null;
      this.onBuildChange(build);
    }
    await this.renderProgression();
  }

  async ensureChoiceCatalogs() {
    const categories = ['feats', 'spells', 'equipment'];
    await Promise.all(categories.map((category) => this.getCatalogItems(category)));
    return Object.fromEntries(categories.map((category) => [category, this.catalogs.get(category) || []]));
  }

  async renderProgression() {
    if (!this.selectedClass) {
      this.featureList.replaceChildren(createElement('p', 'hint', 'Choose a class to review its progression and structured choices.'));
      this.choiceList.replaceChildren();
      return;
    }
    const level = this.getCharacterLevel();
    const classRecord = await this.repository.getClass(this.selectedClass.id);
    this.selectedClassRecord = classRecord;
    const subclassRecord = this.selectedSubclass;
    const features = getCharacterFeatures(classRecord, subclassRecord, level);
    this.featureList.replaceChildren(createElement('h5', '', `Features through level ${level}`));
    features.forEach((feature) => {
      const disclosure = document.createElement('details');
      disclosure.className = 'cf-builder-feature';
      const summary = createElement('summary', '', `Level ${feature.level} · ${feature.source} · ${feature.name}`);
      disclosure.append(summary, createElement('p', 'cf-builder-description', feature.description));
      this.featureList.append(disclosure);
    });

    const choices = [
      ...(classRecord.choices || []).map((choice) => ({ ...choice, ownerName: classRecord.name })),
      ...(subclassRecord?.choices || []).map((choice) => ({ ...choice, ownerName: subclassRecord.name })),
    ].filter((choice) => choice.scope !== 'runtime' && choice.level <= level);
    this.choiceList.replaceChildren(createElement('h5', '', 'Structured choices'));
    if (!choices.length) this.choiceList.append(createElement('p', 'hint', 'No structured choices are available at this level. Review feature descriptions above; some choices may remain prose-only in the current data.'));
    const catalogs = await this.ensureChoiceCatalogs();
    choices.forEach((choice) => this.renderChoice(choice, catalogs));
  }

  renderChoice(choice, catalogs) {
    const build = this.getBuild() || {};
    const selected = build.selections?.find((selection) => selection.choiceId === choice.id)?.selectedOptionIds || [];
    const resolved = resolveChoiceOptions(choice, { catalogs, classId: this.selectedClass?.id });
    const wrapper = createElement('fieldset', 'cf-builder-choice');
    wrapper.append(createElement('legend', '', `${choice.feature} · Level ${choice.level}`));
    wrapper.append(createElement('p', 'hint', choice.prompt));
    if (!resolved.supported || !resolved.items.length) {
      wrapper.append(createElement('p', 'cf-builder-warning', resolved.reason || 'This choice needs a manual selection based on the feature text.'));
      this.choiceList.append(wrapper);
      return;
    }

    const count = choice.selection?.count || this.resolveCountRule(choice.selection?.countRule, choice) || null;
    const countLabel = count ? `Select up to ${count};` : 'Select options;';
    wrapper.append(createElement('p', 'cf-builder-meta', `${countLabel} ${resolved.items.length} available.`));
    const filter = document.createElement('input');
    filter.type = 'search';
    filter.placeholder = 'Filter these options';
    filter.setAttribute('aria-label', `Filter ${choice.feature} options`);
    const options = createElement('div', 'cf-builder-choice-options');
    const update = () => {
      const needle = filter.value.trim().toLocaleLowerCase();
      options.replaceChildren();
      resolved.items
        .filter((item) => !needle || item.name.toLocaleLowerCase().includes(needle))
        .forEach((item) => {
          const id = itemId(item);
          if (!id) return;
          const label = createElement('label', 'cf-builder-option');
          const input = document.createElement('input');
          input.type = count === 1 ? 'radio' : 'checkbox';
          input.name = `choice-${choice.id}`;
          input.value = id;
          input.checked = selected.includes(id);
          input.addEventListener('change', () => {
            const next = count === 1
              ? (input.checked ? [id] : [])
              : Array.from(options.querySelectorAll('input:checked')).map((control) => control.value);
            if (count && next.length > count) {
              input.checked = false;
              return;
            }
            const nextBuild = setBuildSelection(structuredClone(this.getBuild() || {}), choice.id, next);
            this.onBuildChange(nextBuild);
          });
          label.append(input, document.createTextNode(item.name));
          options.append(label);
        });
    };
    filter.addEventListener('input', update);
    update();
    wrapper.append(filter, options);
    if (choice.changeRule) wrapper.append(createElement('p', 'hint', `Replacement: ${choice.changeRule}`));
    this.choiceList.append(wrapper);
  }

  resolveCountRule(rule, choice) {
    if (!rule) return null;
    if (rule === 'progression.values.weapon-mastery.value') {
      const progression = this.selectedClassRecord?.progression || {};
      return Number(progression[this.getCharacterLevel()]?.values?.['weapon-mastery']?.value) || null;
    }
    return null;
  }
}
