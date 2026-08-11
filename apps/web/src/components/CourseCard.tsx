import { Clock3, Star } from "lucide-react";
import { Link } from "react-router-dom";

import type { Course } from "../data/courses.ts";

export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="course-card">
      <Link to={`/courses/${course.slug}`} className={`course-cover ${course.tone}`}>
        <span className="cover-label">{course.category}</span>
        <span className="cover-code">{`{ ${course.category.toLowerCase()} }`}</span>
      </Link>
      <div className="course-body">
        <div className="chip-row"><span className="chip">{course.level}</span><span>{course.category}</span></div>
        <Link to={`/courses/${course.slug}`} className="course-title">{course.title}</Link>
        <p>{course.summary}</p>
        <div className="teacher-row"><span className="avatar small">{course.teacherName.slice(0, 1)}</span><span>{course.teacherName}</span></div>
        <div className="course-meta">
          <span><Star size={15} fill="currentColor" />{course.rating}</span>
          <span><Clock3 size={15} />{course.lessonCount} 节</span>
          <strong>{course.priceYD} YD</strong>
        </div>
      </div>
    </article>
  );
}
