import {ExternalLink} from 'lucide-react';
import {methodologyBooks} from '@/lib/methodology-library';

export function MethodologyLibrary() {
  return <details className="methodology-library">
    <summary aria-label="Ver libros, descripciones y enlaces de Amazon">
      <span className="methodology-library-copy">
        <span>La IA de Experiments consulta conocimientos metodológicos de referencia y los combina con la memoria privada de tu espacio para ayudarte a formular hipótesis y diseñar experimentos que validen tu propuesta de valor y modelo de negocio.</span>
      </span>
      <span className="methodology-cover-preview">{methodologyBooks.slice(0,3).map(book =>
        <img key={book.id} src={book.cover} width={book.coverWidth} height={book.coverHeight} decoding="async" alt={`Portada de ${book.title}`}/>
      )}</span>
    </summary>
    <div className="methodology-library-body">
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
    </div>
  </details>;
}
