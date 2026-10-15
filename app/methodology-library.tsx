import {BookOpen, ChevronDown, ExternalLink} from 'lucide-react';
import {methodologyBooks, methodologyBookForSource} from '@/lib/methodology-library';

export function MethodologySourceLink({id, title}: {id: string; title: string}) {
  const book = methodologyBookForSource(id);
  return book ? <a href={book.amazonUrl} target="_blank" rel="noopener noreferrer">{book.title} <ExternalLink size={12} aria-hidden="true"/></a> : <span>{title}</span>;
}

export function MethodologyLibrary() {
  return <details className="methodology-library">
    <summary>
      <BookOpen size={22} aria-hidden="true"/>
      <span className="methodology-library-copy">
        <strong>Una biblioteca para experimentar mejor</strong>
        <span>La IA de Experiments incorpora una síntesis metodológica de estos libros para ayudarte a formular hipótesis y diseñar experimentos que validen tu propuesta de valor y modelo de negocio.</span>
      </span>
      <span className="methodology-library-count">{methodologyBooks.length} libros</span>
      <ChevronDown className="methodology-library-chevron" size={20} aria-hidden="true"/>
    </summary>
    <div className="methodology-library-body">
      <p className="methodology-library-note">Incluida por defecto en todos los espacios de trabajo, tanto en el chat como en «Preparar con IA». Se combina con la memoria privada de tu equipo. Son pautas para razonar y aprender; tus resultados conservan su procedencia y estado de validación.</p>
      <div className="methodology-books">{methodologyBooks.map(book => <article className="methodology-book" key={book.id}>
        <img src={book.cover} width={book.coverWidth} height={book.coverHeight} loading="lazy" decoding="async" alt={`Portada de ${book.title}`}/>
        <div className="methodology-book-copy">
          <h3>{book.title}</h3>
          <p className="methodology-book-author">{book.author}</p>
          <p>{book.description}</p>
          <small>{book.edition}</small>
          <a href={book.amazonUrl} target="_blank" rel="noopener noreferrer" aria-label={`Comprar ${book.title} en Amazon (se abre en otra pestaña)`}>Comprar en Amazon <ExternalLink size={14} aria-hidden="true"/></a>
        </div>
      </article>)}</div>
      <p className="methodology-library-note">Esta biblioteca irá creciendo con nuevos libros. Las síntesis no sustituyen su lectura. Las portadas y obras pertenecen a sus respectivos autores y editores.</p>
    </div>
  </details>;
}
