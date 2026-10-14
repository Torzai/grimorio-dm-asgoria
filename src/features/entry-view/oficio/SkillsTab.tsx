import { useEffect, useEffectEvent, useId } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { indexOficio, type Habilidad, type OficioIndex, type OficioMeta } from '@/content/oficio';
import type { EntryMeta } from '@/content/types';
import { useEntryBody } from '@/content/use-entry-body';
import { MarkdownBody } from '../EntryBody';
import { scrollAndFlash } from '../scroll-to';
import { openedFromTabBar, skillParams, useParamLink } from './oficio-url';
import styles from './OficioView.module.css';

interface SkillsTabProps {
  entry: EntryMeta<'oficio'>;
  meta: OficioMeta;
}

const skillAnchor = (numero: number) => `habilidad-${numero}`;

/**
 * Habilidades y tiradas: the skills by level, each with its cost and the skill it requires (a
 * link that scrolls to it, ?h=), and under them the body of the file (rolls and notes).
 */
export function SkillsTab({ entry, meta }: SkillsTabProps) {
  const index = indexOficio(meta);
  const [params] = useSearchParams();
  const location = useLocation();
  const body = useEntryBody(entry.path);
  const target = index.skills.get(Number(params.get('h')))?.numero;

  // Scroll to the skill a link points to and flash it, again on every link to it; not when the
  // tab bar opens the tab.
  const fromTabBar = useEffectEvent(() => openedFromTabBar(location.state));
  useEffect(() => {
    if (target === undefined || fromTabBar()) return;
    const card = document.getElementById(skillAnchor(target));
    return card ? scrollAndFlash(card, card.querySelector('h4')) : undefined;
  }, [target, location.key]);

  const levels = new Map<number, Habilidad[]>();
  for (const skill of meta.skills)
    levels.set(skill.nivel, [...(levels.get(skill.nivel) ?? []), skill]);
  const headingId = useId();
  const notesId = useId();

  return (
    <div className={styles.skills}>
      <section className={styles.skillLevels} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.panelTitle}>
          Habilidades
        </h2>
        {levels.size === 0 ? (
          <p className={styles.muted}>Este oficio no tiene habilidades.</p>
        ) : (
          [...levels].map(([nivel, skills]) => (
            <SkillLevel key={nivel} nivel={nivel} skills={skills} index={index} />
          ))
        )}
      </section>

      <section className={styles.notes} aria-labelledby={notesId}>
        <h2 id={notesId} className="visually-hidden">
          Tiradas y notas
        </h2>
        {body === undefined ? (
          <p className={styles.muted} aria-busy="true">
            Cargando…
          </p>
        ) : body.trim() ? (
          <MarkdownBody markdown={body} />
        ) : (
          <p className={styles.muted}>Este oficio no tiene tiradas ni notas.</p>
        )}
      </section>
    </div>
  );
}

function SkillLevel({
  nivel,
  skills,
  index,
}: {
  nivel: number;
  skills: readonly Habilidad[];
  index: OficioIndex;
}) {
  const id = useId();
  const link = useParamLink();
  return (
    <section className={styles.level} aria-labelledby={id}>
      <h3 id={id} className={styles.blockTitle}>
        {`Nivel ${nivel}`}
      </h3>
      <ul className={styles.skillList}>
        {skills.map(({ numero, nombre, axp, requiere, descripcion }) => {
          const required = requiere === undefined ? undefined : index.skills.get(requiere);
          return (
            <li key={numero}>
              <article id={skillAnchor(numero)} className={styles.skill}>
                <div className={styles.skillHead}>
                  <h4 tabIndex={-1} className={styles.skillName}>
                    <span className={styles.skillNumber}>{numero}</span>
                    <span className="visually-hidden"> · </span>
                    {nombre}
                  </h4>
                  {axp !== undefined && <span className={styles.pill}>{`${axp} aXP`}</span>}
                </div>
                <p className={styles.text}>{descripcion}</p>
                {requiere !== undefined && (
                  <p className={styles.skillRequires}>
                    {'Requiere: '}
                    {required ? (
                      <Link to={link(skillParams(requiere))}>
                        {`${requiere} · ${required.nombre}`}
                      </Link>
                    ) : (
                      `nº ${requiere} (no existe)`
                    )}
                  </p>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
